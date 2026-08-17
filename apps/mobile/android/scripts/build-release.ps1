<#
.SYNOPSIS
  Auvora Wallet — one-shot LOCAL Windows release builder.

  Generates the real Google Play upload key (if missing), configures signing,
  builds the final signed AAB + release APK, verifies signatures, inspects the
  artifacts (SDK/permissions/16 KB), scans compiled artifacts for secrets, and
  creates a local encrypted backup of the signing material.

.DESCRIPTION
  RUN THIS ONLY ON YOUR LOCAL WINDOWS MACHINE at D:\auvora-wallet.
  It intentionally refuses to run in a CI / Cloud Agent / non-Windows / ephemeral
  environment. It NEVER commits the keystore, key.properties, passwords, backups,
  WC_PROJECT_ID, or AUVORA_API_BASE_URL, and NEVER passes server secrets into
  the app build. Client dart-defines (WC + public Gateway URL) are resolved from
  local/gitignored config only — never hardcoded.

.NOTES
  Usage (from anywhere):  powershell -ExecutionPolicy Bypass -File D:\auvora-wallet\apps\mobile\android\scripts\build-release.ps1
#>

[CmdletBinding()]
param(
  [string]$ExpectedRepoRoot = 'D:\auvora-wallet',
  [switch]$ReuseExistingKey
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
# Needed for ZIP inspection on Windows PowerShell 5.1 (already present in PS 7+).
try { Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue } catch {}
# On PS 7.4+ native non-zero exits throw under ErrorActionPreference=Stop; disable so
# our explicit $LASTEXITCODE checks (git check-ignore, flutter analyze, keytool) work.
$PSNativeCommandUseErrorActionPreference = $false

# ----------------------------------------------------------------------------
# Output helpers (never print secrets through these)
# ----------------------------------------------------------------------------
function Info([string]$m) { Write-Host "[*] $m" -ForegroundColor Cyan }
function Ok([string]$m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Warn([string]$m) { Write-Host "[!] $m" -ForegroundColor Yellow }
function Die([string]$m)  { Write-Host "[FAIL] $m" -ForegroundColor Red; exit 1 }
function Invoke-NativeOutput([scriptblock]$Command) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $raw = & $Command 2>&1
    return (($raw | ForEach-Object { "$_" }) -join "`n")
  } finally {
    $ErrorActionPreference = $prev
  }
}

$PACKAGE = 'com.auvora.auvora_wallet'
$ALIAS   = 'upload'

# ============================================================================
# 1. HARD SAFETY GATE
# ============================================================================
Info 'Safety gate: verifying local Windows environment...'

# $IsWindows only exists on PowerShell 6+; fall back to $env:OS on 5.1.
$onWindows = ($env:OS -eq 'Windows_NT')
if (Get-Variable -Name IsWindows -Scope Global -ErrorAction SilentlyContinue) { $onWindows = $IsWindows }
if (-not $onWindows) {
  Die 'This script must run on Windows only.'
}
# Refuse ephemeral / remote / CI environments.
foreach ($marker in @($env:CI, $env:CURSOR_AGENT, $env:GITHUB_ACTIONS)) {
  if ($marker) { Die 'Refusing to run in a CI / Cloud Agent environment. Run locally on your PC.' }
}
if (Test-Path '/workspace' -ErrorAction SilentlyContinue) { Die 'Detected /workspace — refusing to run in an ephemeral remote VM.' }
if (Test-Path '/opt/cursor' -ErrorAction SilentlyContinue) { Die 'Detected /opt/cursor — refusing to run in a Cloud Agent.' }

# Resolve repo root from the script location, then validate it.
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$expectedResolved = Resolve-Path $ExpectedRepoRoot -ErrorAction SilentlyContinue
if ($expectedResolved -and ($repoRoot -ne $expectedResolved.Path)) {
  Warn "Repo root resolved to '$repoRoot' (expected '$ExpectedRepoRoot')."
}
if (-not (Test-Path $ExpectedRepoRoot)) { Die "Expected project path '$ExpectedRepoRoot' not found." }

$mobileDir  = Join-Path $repoRoot 'apps\mobile'
$androidDir = Join-Path $mobileDir 'android'
if (-not (Test-Path $mobileDir))  { Die "apps/mobile not found under $repoRoot" }
if (-not (Test-Path $androidDir)) { Die "apps/mobile/android not found under $repoRoot" }
Ok "Environment OK. Repo root: $repoRoot"

# ============================================================================
# 2. GIT SAFETY
# ============================================================================
Info 'Git safety checks...'
Push-Location $repoRoot
try {
  $insideRepo = (& git rev-parse --is-inside-work-tree 2>$null)
  if ($insideRepo -ne 'true') { Die 'Not a git repository.' }

  $remotes = (& git remote -v) -join "`n"
  if ($remotes -notmatch 'Auvora-wallet-app') { Die 'This repo does not look like Auvora-wallet-app.' }

  $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -ne 'main') { Die "Current branch is '$branch'; expected 'main'." }

  $status = (& git status --porcelain)
  if ($status) { Die 'Working tree is not clean. Commit/stash changes before building a release.' }

  # Prove signing files are ignored (paths are relative to repo root).
  $ignoreTargets = @(
    'apps/mobile/android/upload-keystore.jks',
    'apps/mobile/android/key.properties',
    'apps/mobile/android/keystore.properties',
    'apps/mobile/android/x.jks',
    'apps/mobile/android/x.keystore',
    'apps/mobile/android/x.p12'
  )
  foreach ($t in $ignoreTargets) {
    & git check-ignore -q -- $t
    if ($LASTEXITCODE -ne 0) { Die "Signing artifact pattern is NOT gitignored: $t . Fix .gitignore first." }
  }
  Ok "Git clean on 'main'; all signing artifact patterns are gitignored."
}
finally { Pop-Location }

# ============================================================================
# Tool discovery helpers
# ============================================================================
function Get-Tool([string]$name, [string[]]$fallbacks = @()) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($f in $fallbacks) { if ($f -and (Test-Path $f)) { return $f } }
  return $null
}

$javaHome = $env:JAVA_HOME
$keytool = Get-Tool 'keytool' @( if ($javaHome) { Join-Path $javaHome 'bin\keytool.exe' } )
if (-not $keytool) { Die 'keytool not found. Install a JDK and/or set JAVA_HOME.' }

$sdkRoot = $env:ANDROID_SDK_ROOT; if (-not $sdkRoot) { $sdkRoot = $env:ANDROID_HOME }
function Get-BuildTool([string]$exe) {
  if (-not $sdkRoot) { return $null }
  $bt = Join-Path $sdkRoot 'build-tools'
  if (-not (Test-Path $bt)) { return $null }
  $ver = Get-ChildItem $bt -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $ver) { return $null }
  $p = Join-Path $ver.FullName $exe
  if (Test-Path $p) { return $p }
  return $null
}
$apksigner = Get-Tool 'apksigner' @( (Get-BuildTool 'apksigner.bat') )
$aapt2     = Get-Tool 'aapt2'     @( (Get-BuildTool 'aapt2.exe') )
$flutter   = Get-Tool 'flutter'
$adb       = Get-Tool 'adb' @( if ($sdkRoot) { Join-Path $sdkRoot 'platform-tools\adb.exe' } )
if (-not $flutter) { Die 'flutter not found on PATH.' }

# ============================================================================
# 3. EXISTING KEY PROTECTION
# ============================================================================
$keystorePath = Join-Path $androidDir 'upload-keystore.jks'
$keyPropsPath = Join-Path $androidDir 'key.properties'
$useExisting = $false

if (Test-Path $keystorePath) {
  Warn "An upload keystore already exists: $keystorePath"
  if ($ReuseExistingKey) {
    $useExisting = $true
    Ok 'Reusing existing upload keystore (no overwrite; -ReuseExistingKey).'
  } else {
    $ans = Read-Host 'Use the EXISTING key? (yes = reuse / no = abort — will NOT overwrite) [yes/no]'
    if ($ans -notin @('y','yes')) { Die 'Aborting to protect the existing production upload key. Nothing changed.' }
    $useExisting = $true
    Ok 'Reusing existing upload keystore (no overwrite).'
  }
}

# ============================================================================
# 4/5. SECURE PASSWORD ENTRY + GENERATE REAL UPLOAD KEY
# ============================================================================
function Read-StrongSecret([string]$prompt, [switch]$NoStrength) {
  while ($true) {
    $s = Read-Host -AsSecureString $prompt
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if (-not $NoStrength) {
      if ($plain.Length -lt 12) { Warn 'Too short — use at least 12 characters.'; continue }
      if (($plain.ToCharArray() | Select-Object -Unique).Count -lt 6) { Warn 'Too weak — use more variety.'; continue }
    } elseif ($plain.Length -lt 1) { Warn 'Password cannot be empty.'; continue }
    return $plain
  }
}

$storePass = $null; $keyPass = $null
if ($useExisting) {
  $loadedFromProps = $false
  if ($ReuseExistingKey -and (Test-Path $keyPropsPath)) {
    $kpMap = @{}
    Get-Content $keyPropsPath | ForEach-Object {
      if ($_ -match '^\s*([^#=]+)=(.*)$') { $kpMap[$Matches[1].Trim()] = $Matches[2] }
    }
    if ($kpMap['storePassword'] -and $kpMap['keyPassword']) {
      $storePass = $kpMap['storePassword'] -replace '\\','\'
      $keyPass = $kpMap['keyPassword'] -replace '\\','\'
      $loadedFromProps = $true
      Ok 'Loaded existing key passwords from gitignored key.properties (values hidden).'
    }
  }
  if (-not $loadedFromProps) {
    $storePass = Read-StrongSecret 'Enter EXISTING keystore (store) password' -NoStrength
    $keyPass   = Read-StrongSecret "Enter EXISTING key password for alias '$ALIAS'" -NoStrength
  }
} else {
  Info 'Creating a NEW production upload key. Choose strong passwords (store them in your password manager).'
  $storePass = Read-StrongSecret 'Create keystore (store) password'
  $confirm   = Read-StrongSecret 'Re-enter keystore (store) password'
  if ($storePass -ne $confirm) { Die 'Store passwords did not match.' }
  $keyPass   = Read-StrongSecret "Create key password for alias '$ALIAS'"
  $keyConfirm= Read-StrongSecret 'Re-enter key password'
  if ($keyPass -ne $keyConfirm) { Die 'Key passwords did not match.' }

  Info 'Generating RSA 2048 upload key (validity 10000 days)...'
  $dname = 'CN=Auvora Wallet, OU=Engineering, O=Auvora, L=NA, ST=NA, C=US'
  # Feed passwords via stdin so they never appear in the process command line.
  $ktInput = "$storePass`n$storePass`n$keyPass`n"
  $ktArgs = @('-genkeypair','-v','-keystore',$keystorePath,'-storetype','JKS','-keyalg','RSA','-keysize','2048','-validity','10000','-alias',$ALIAS,'-dname',$dname)
  $ktInput | & $keytool @ktArgs
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $keystorePath)) { Die 'keytool failed to create the keystore.' }
  Ok "Upload keystore created: $keystorePath"
}

# ============================================================================
# 6. CREATE key.properties (gitignored)
# ============================================================================
Info 'Writing key.properties (gitignored, never committed)...'
# Java .properties treats backslash as an escape char; double any in the values so
# the passwords load verbatim (avoids confusing "keystore password incorrect").
$storePassProp = $storePass -replace '\\','\\'
$keyPassProp   = $keyPass   -replace '\\','\\'
$kp = @(
  "storePassword=$storePassProp",
  "keyPassword=$keyPassProp",
  "keyAlias=$ALIAS",
  'storeFile=upload-keystore.jks'
) -join "`r`n"
Set-Content -Path $keyPropsPath -Value $kp -Encoding ASCII -NoNewline
# Confirm not tracked.
Push-Location $repoRoot
& git check-ignore -q -- 'apps/mobile/android/key.properties'
if ($LASTEXITCODE -ne 0) { Pop-Location; Die 'key.properties is not gitignored — aborting.' }
Pop-Location
Ok 'key.properties written and confirmed gitignored.'

# ============================================================================
# 7. VERIFY KEY (fingerprints; never print private material)
# ============================================================================
Info 'Inspecting keystore certificate...'
$certText = Invoke-NativeOutput { & $keytool -list -v -keystore $keystorePath -alias $ALIAS -storepass $storePass }
if ($LASTEXITCODE -ne 0) {
  Die 'keytool could not read the upload keystore. The existing-key password was rejected, or keytool failed.'
}
if ($certText -match 'Android Debug' ) { Die 'Keystore appears to be an Android debug certificate — aborting.' }
$sha1   = if ($certText -match 'SHA1:\s*([0-9A-F:]+)')   { $Matches[1] } else { '(unavailable)' }
$sha256 = if ($certText -match 'SHA256:\s*([0-9A-F:]+)') { $Matches[1] } else { '(unavailable)' }
if ($certText -notmatch 'RSA') { Warn 'Could not confirm RSA in cert listing (continuing).' }
Ok "Key verified. Alias=$ALIAS SHA-1=$sha1"

# ============================================================================
# 8. CLIENT DART-DEFINES (local only; never from git history; never committed)
# ============================================================================
# Resolves WC_PROJECT_ID / REOWN_PROJECT_ID and AUVORA_API_BASE_URL from the
# process environment or gitignored files. Values are never printed. Temporary
# Railway private / localhost URLs are rejected (not hardcoded, not injected).

function Read-GitignoredDefine {
  param([string[]]$Names)
  foreach ($name in $Names) {
    $fromEnv = [Environment]::GetEnvironmentVariable($name)
    if ($fromEnv -and $fromEnv.Trim()) { return $fromEnv.Trim() }
  }
  $files = @(
    (Join-Path $androidDir 'wc.local'),
    (Join-Path $androidDir 'api.local'),
    (Join-Path $mobileDir '.env.local'),
    (Join-Path $mobileDir '.env'),
    (Join-Path $repoRoot '.env.local'),
    (Join-Path $repoRoot '.env')
  )
  foreach ($f in $files) {
    if (-not (Test-Path $f)) { continue }
    foreach ($name in $Names) {
      $line = (Get-Content $f | Where-Object { $_ -match ("^\s*" + [Regex]::Escape($name) + "\s*=") } | Select-Object -First 1)
      if ($line) {
        $val = ($line -replace ("^\s*" + [Regex]::Escape($name) + "\s*=\s*"), '').Trim().Trim('"').Trim("'")
        if ($val) { return $val }
      }
    }
  }
  return $null
}

function Test-TemporaryApiUrl([string]$url) {
  $l = $url.ToLowerInvariant()
  return ($l -match 'localhost' -or $l -match '127\.0\.0\.1' -or $l -match '\[::1\]' -or
          $l -match 'railway\.internal' -or $l -match '\.rlwy\.' -or $l -match 'up\.railway\.app' -or
          $l -match 'ngrok' -or $l -match 'cloudflare-tunnel')
}

Info 'Resolving WC_PROJECT_ID from local/gitignored config only...'
$wc = Read-GitignoredDefine -Names @('WC_PROJECT_ID','REOWN_PROJECT_ID')
$wcConfigured = $false
if (-not $wc) {
  $entered = Read-Host 'WC_PROJECT_ID not found locally. Paste production Reown/WC project ID (leave blank to skip)'
  if ($entered.Trim()) { $wc = $entered.Trim() }
}
if ($wc) { $wcConfigured = $true; Ok 'WC_PROJECT_ID resolved (value hidden).' }
else { Warn 'WC_PROJECT_ID MISSING — WalletConnect/Reown will be unconfigured in this build.' }

Info 'Resolving AUVORA_API_BASE_URL from local/gitignored config only...'
$apiBase = Read-GitignoredDefine -Names @('AUVORA_API_BASE_URL')
$apiConfigured = $false
if ($apiBase -and (Test-TemporaryApiUrl $apiBase)) {
  Warn 'AUVORA_API_BASE_URL looks like a temporary/private host — not injecting. Use the public gateway URL.'
  $apiBase = $null
}
if (-not $apiBase) {
  $enteredApi = Read-Host 'AUVORA_API_BASE_URL not found. Paste production gateway URL (leave blank to skip; do not use Railway private domains)'
  if ($enteredApi.Trim()) {
    if (Test-TemporaryApiUrl $enteredApi.Trim()) {
      Warn 'Rejected temporary/private AUVORA_API_BASE_URL — account features will stay unconfigured in this build.'
    } else {
      $apiBase = $enteredApi.Trim().TrimEnd('/')
    }
  }
}
if ($apiBase) {
  try {
    $parsedApi = [Uri]$apiBase
    if ($parsedApi.Scheme -ne 'https') {
      Warn 'AUVORA_API_BASE_URL must be https — not injecting.'
      $apiBase = $null
    }
  } catch {
    Warn 'AUVORA_API_BASE_URL is not a valid URL — not injecting.'
    $apiBase = $null
  }
}
if ($apiBase) { $apiConfigured = $true; Ok 'AUVORA_API_BASE_URL resolved (value hidden).' }
else { Warn 'AUVORA_API_BASE_URL MISSING — Android account features will stay unconfigured in this build.' }

# ============================================================================
# 10. TOOLCHAIN CHECK
# ============================================================================
Info 'flutter doctor -v ...'
Push-Location $mobileDir
try { & $flutter doctor -v } catch { Warn 'flutter doctor reported issues (review above).' }
Pop-Location
if (-not $apksigner) { Warn 'apksigner not found (Android build-tools) — APK signature verification will be limited.' }
if (-not $aapt2)     { Warn 'aapt2 not found (Android build-tools) — badging inspection will be limited.' }

# ============================================================================
# 11. PRE-BUILD VALIDATION
# ============================================================================
Push-Location $mobileDir
try {
  Info 'flutter clean'; & $flutter clean | Out-Null
  Info 'flutter pub get'; & $flutter pub get
  Info 'flutter analyze'; & $flutter analyze
  if ($LASTEXITCODE -ne 0) { Die 'flutter analyze failed.' }
  Info 'flutter test'; & $flutter test
  if ($LASTEXITCODE -ne 0) { Die 'flutter test failed.' }
  Ok 'analyze + tests passed.'

  # ==========================================================================
  # 12/13. BUILD FINAL AAB + APK (only client-side dart-defines)
  # ==========================================================================
  $defines = @()
  if ($wcConfigured) { $defines += "--dart-define=WC_PROJECT_ID=$wc" }
  if ($apiConfigured) { $defines += "--dart-define=AUVORA_API_BASE_URL=$apiBase" }

  Info 'Building release AAB...'
  & $flutter build appbundle --release @defines
  $aab = Join-Path $mobileDir 'build\app\outputs\bundle\release\app-release.aab'
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $aab)) { Die 'AAB build failed.' }
  Ok "AAB: $aab"

  Info 'Building release APK...'
  & $flutter build apk --release @defines
  $apk = Join-Path $mobileDir 'build\app\outputs\flutter-apk\app-release.apk'
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $apk)) { Die 'APK build failed.' }
  Ok "APK: $apk"
}
finally { Pop-Location }

# Normalize a fingerprint to lowercase hex without separators for comparison.
function Norm([string]$s) { return ($s -replace '[^0-9A-Fa-f]','').ToLower() }

# ============================================================================
# 14. SIGNATURE VERIFICATION
# ============================================================================
$apkSigned = $false; $aabSigned = $false; $certMatch = $false; $apkDebug = $true
$storeSha256Norm = Norm($sha256)

if ($apksigner) {
  Info 'apksigner verify (APK)...'
  $apkVerify = Invoke-NativeOutput { & $apksigner verify --print-certs $apk }
  $apkSigned = ($apkVerify -match 'Verified using v\d' ) -or ($apkVerify -match 'certificate DN')
  $apkDebug  = ($apkVerify -match 'CN=Android Debug')
  $apkSha = if ($apkVerify -match 'certificate SHA-256 digest:\s*([0-9a-fA-F]+)') { $Matches[1] } else { '' }
  if ($storeSha256Norm -and (Norm($apkSha)) -eq $storeSha256Norm) { $certMatch = $true }
}

Info 'Verifying AAB signature...'
$aabCert = Invoke-NativeOutput { & $keytool -printcert -jarfile $aab }
$aabSigned = ($aabCert -match 'SHA256:')
$aabSha = if ($aabCert -match 'SHA256:\s*([0-9A-F:]+)') { $Matches[1] } else { '' }
if ($storeSha256Norm -and (Norm($aabSha)) -eq $storeSha256Norm) { $certMatch = $true } elseif (-not $apksigner) { }
if ($aabCert -match 'Android Debug') { Die 'AAB signed with a debug certificate — aborting.' }

# ============================================================================
# 15/18. ARTIFACT + 16 KB CHECKS
# ============================================================================
$targetSdk=''; $minSdk=''; $abis=''; $permsBad=@(); $postNotifPresent=$false
if ($aapt2) {
  $badging = (& $aapt2 dump badging $apk 2>$null) -join "`n"
  if ($badging -match "targetSdkVersion:'(\d+)'") { $targetSdk = $Matches[1] }
  if ($badging -match "sdkVersion:'(\d+)'")       { $minSdk = $Matches[1] }
  $abis = (($badging -split "`n") | Where-Object { $_ -match 'native-code:' }) -join ' '
  $postNotifPresent = ($badging -match 'POST_NOTIFICATIONS')
  foreach ($risk in @('ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION','READ_CONTACTS','RECORD_AUDIO','READ_SMS','READ_PHONE_STATE','MANAGE_EXTERNAL_STORAGE','QUERY_ALL_PACKAGES')) {
    if ($badging -match $risk) { $permsBad += $risk }
  }
}

# 16 KB page-size: parse ELF64 program headers of arm64 .so; require PT_LOAD p_align >= 0x4000.
function Test-16k([string]$soPath) {
  $b = [System.IO.File]::ReadAllBytes($soPath)
  if ($b.Length -lt 64 -or $b[0] -ne 0x7F -or $b[1] -ne 0x45) { return $true } # not ELF -> ignore
  $phoff = [BitConverter]::ToUInt64($b, 0x20)
  $phentsize = [BitConverter]::ToUInt16($b, 0x36)
  $phnum = [BitConverter]::ToUInt16($b, 0x38)
  for ($i=0; $i -lt $phnum; $i++) {
    $off = [int]$phoff + ($i * $phentsize)
    $ptype = [BitConverter]::ToUInt32($b, $off)
    if ($ptype -eq 1) { # PT_LOAD
      $palign = [BitConverter]::ToUInt64($b, $off + 0x30)
      if ($palign -lt 0x4000) { return $false }
    }
  }
  return $true
}

$sixteenKb = $true; $badLibs=@()
$extractDir = Join-Path $env:TEMP ("auvora_apk_" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $extractDir | Out-Null
try {
  $zip = [IO.Compression.ZipFile]::OpenRead($apk)
  try {
    foreach ($e in $zip.Entries) {
      if ($e.FullName -like 'lib/arm64-v8a/*.so') {
        $dest = Join-Path $extractDir ([IO.Path]::GetFileName($e.FullName))
        [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
        if (-not (Test-16k $dest)) { $sixteenKb = $false; $badLibs += $e.FullName }
      }
    }
  } finally { $zip.Dispose() }
} catch { Warn "16 KB check could not run: $($_.Exception.Message)" }

# ============================================================================
# 16/19. SECRET SCAN (compiled artifacts)
# ============================================================================
Info 'Scanning compiled artifacts for server secrets...'
$secretHit = $null
$patterns = @(
  'alcht_[A-Za-z0-9]{10,}',
  'postgres(ql)?://[^ ''"]*:[^ ''"@]+@',
  'redis://[^ ''"]*:[^ ''"@]+@',
  'eyJhbGciOi[A-Za-z0-9_-]{20,}',
  '-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----',
  '(INTERNAL_API_KEY|CSRF_SECRET|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET)=[^ ]{8,}',
  'FIELD_ENCRYPTION_KEY=[0-9a-fA-F]{16,}'
)
$scanFiles = @()
Get-ChildItem $extractDir -Filter *.so -ErrorAction SilentlyContinue | ForEach-Object { $scanFiles += $_.FullName }
# also scan flutter assets
try {
  $zip2 = [IO.Compression.ZipFile]::OpenRead($apk)
  try {
    foreach ($e in $zip2.Entries) {
      if ($e.FullName -like 'assets/*' -and $e.Length -lt 2000000) {
        $dest = Join-Path $extractDir ("asset_" + ($e.FullName -replace '[\\/]','_'))
        [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true); $scanFiles += $dest
      }
    }
  } finally { $zip2.Dispose() }
} catch {}
foreach ($f in $scanFiles) {
  $txt = ''
  try { $txt = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($f)) } catch { continue }
  foreach ($p in $patterns) { if ($txt -match $p) { $secretHit = "$p in $([IO.Path]::GetFileName($f))"; break } }
  if ($secretHit) { break }
}
Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
if ($secretHit) { Die "SERVER SECRET pattern found in compiled artifact: $secretHit" }
Ok 'No server secrets found in compiled artifacts.'

# ============================================================================
# 7-cont. BACKUP (keystore + DPAPI-encrypted credentials)
# ============================================================================
$backupDir = 'D:\Auvora-Signing-Backup'
Info "Creating local backup at $backupDir ..."
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $keystorePath (Join-Path $backupDir 'upload-keystore.jks') -Force
# Non-secret signing info record.
@(
  "package=$PACKAGE",
  "alias=$ALIAS",
  "algorithm=RSA-2048",
  "created=$(Get-Date -Format o)",
  "certSHA1=$sha1",
  "certSHA256=$sha256"
) -join "`r`n" | Set-Content -Path (Join-Path $backupDir 'signing-info.txt') -Encoding UTF8
# DPAPI-encrypted passwords (decryptable ONLY by this Windows user on this machine).
($storePass | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString) | Set-Content (Join-Path $backupDir 'storePassword.dpapi')
($keyPass   | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString) | Set-Content (Join-Path $backupDir 'keyPassword.dpapi')
Ok 'Backup written (keystore + DPAPI-encrypted passwords + signing-info.txt).'

# Clear plaintext password variables from memory ASAP.
$storePass=$null; $keyPass=$null; [GC]::Collect()

# ============================================================================
# 17/21. DEVICE QA (optional)
# ============================================================================
$deviceTest = 'NOT RUN'
if ($adb -and -not $ReuseExistingKey) {
  $devs = (& $adb devices) -join "`n"
  $connected = ($devs -split "`n" | Where-Object { $_ -match "`tdevice$" }).Count
  if ($connected -ge 1) {
    $inst = Read-Host 'Android device detected. Install & launch the release APK for smoke test? [yes/no]'
    if ($inst -in @('y','yes')) {
      & $adb install -r $apk
      & $adb shell monkey -p $PACKAGE -c android.intent.category.LAUNCHER 1 | Out-Null
      $deviceTest = 'INSTALLED (manually verify launch/onboarding/QR/biometric/WalletConnect/offline UI)'
    }
  }
}

# ============================================================================
# 18-cont / 22. FINAL GIT SAFETY
# ============================================================================
Push-Location $repoRoot
$tracked = (& git ls-files) -join "`n"
$leak = $false
foreach ($needle in @('upload-keystore.jks','key.properties','storePassword.dpapi','keyPassword.dpapi')) {
  if ($tracked -match [Regex]::Escape($needle)) { $leak = $true; Warn "TRACKED BY GIT: $needle" }
}
$gitSafety = if ($leak) { 'FAIL' } else { 'PASS' }
Pop-Location

# ============================================================================
# 19. FINAL OUTPUT
# ============================================================================
$aabItem = Get-Item (Join-Path $mobileDir 'build\app\outputs\bundle\release\app-release.aab')
$aabSizeMB = [math]::Round($aabItem.Length/1MB,1)

Write-Host ''
Write-Host 'AUVORA LOCAL RELEASE BUILD COMPLETE' -ForegroundColor Green
Write-Host ("UPLOAD KEY: " + $(if ($useExisting) {'existing'} else {'created'}))
Write-Host ("UPLOAD KEY PATH: " + $keystorePath)
Write-Host ("BACKUP PATH: " + $backupDir)
Write-Host ("KEY ALIAS: " + $ALIAS)
Write-Host ("CERT SHA-1: " + $sha1)
Write-Host ("CERT SHA-256: " + $sha256)
Write-Host ("WC_PROJECT_ID: " + $(if ($wcConfigured) {'CONFIGURED'} else {'MISSING'}))
Write-Host ("AUVORA_API_BASE_URL: " + $(if ($apiConfigured) {'CONFIGURED'} else {'MISSING'}))
Write-Host 'FLUTTER ANALYZE: PASS'
Write-Host 'FLUTTER TEST: PASS'
Write-Host ("AAB: PASS  " + $aabItem.FullName)
Write-Host ("AAB SIZE: " + $aabSizeMB + ' MB')
Write-Host ("APK: PASS  " + (Join-Path $mobileDir 'build\app\outputs\flutter-apk\app-release.apk'))
Write-Host ("APK SIGNED: " + $(if ($apkSigned) {'YES'} else {'NO'}))
Write-Host ("AAB SIGNED: " + $(if ($aabSigned) {'YES'} else {'NO'}))
Write-Host ("UPLOAD CERT MATCH: " + $(if ($certMatch) {'YES'} else {'NO'}))
Write-Host ("DEBUG CERTIFICATE: " + $(if ($apkDebug) {'YES'} else {'NO'}))
Write-Host ("TARGET SDK: " + $targetSdk)
Write-Host ("MIN SDK: " + $minSdk)
Write-Host ("ABIs: " + $abis)
Write-Host ("POST_NOTIFICATIONS PRESENT: " + $(if ($postNotifPresent) {'YES (unexpected)'} else {'NO'}))
Write-Host ("16 KB PAGE SIZE: " + $(if ($sixteenKb) {'PASS'} else {'FAIL — ' + ($badLibs -join ', ')}))
Write-Host ("UNEXPECTED PERMISSIONS: " + $(if ($permsBad.Count) {($permsBad -join ', ')} else {'NONE'}))
Write-Host 'SERVER SECRET EXPOSURE: NONE'
Write-Host ("GIT SIGNING FILE SAFETY: " + $gitSafety)
Write-Host ("DEVICE TEST: " + $deviceTest)
$ready = ($apkSigned -and $aabSigned -and $certMatch -and (-not $apkDebug) -and $sixteenKb -and ($gitSafety -eq 'PASS') -and $wcConfigured -and $apiConfigured)
Write-Host ("READY FOR PLAY CONSOLE: " + $(if ($ready) {'YES'} else {'NO — review flags above'}))
Write-Host ''
Write-Host 'BACKUP ACTION REQUIRED:' -ForegroundColor Yellow
Write-Host "  Copy these to a SECOND encrypted/offline location (e.g. encrypted USB + password manager):"
Write-Host "    - $backupDir\upload-keystore.jks"
Write-Host "    - $backupDir\signing-info.txt"
Write-Host "    - the store & key passwords (store them in your password manager;"
Write-Host "      the .dpapi files only decrypt on THIS Windows user account, so keep the"
Write-Host "      passwords themselves in your manager as the portable backup)."
Write-Host ''
Write-Host 'NEXT ACTION: Upload app-release.aab to the Google Play Console (Internal testing track) and enroll in Play App Signing.' -ForegroundColor Cyan
Write-Host 'Do not publish to production until store listing, privacy policy, and declarations are complete.'
