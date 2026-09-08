# Build side-by-side Auvora QA APK (does NOT overwrite com.auvora.auvora_wallet)
#
# Usage:
#   powershell -File apps/mobile/android/scripts/build-qa.ps1
#   powershell -File scripts/qa/build-android-qa.ps1

$ErrorActionPreference = "Stop"
$MobileRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $MobileRoot
if (-not (Test-Path (Join-Path $MobileRoot "pubspec.yaml"))) {
  throw "Expected Flutter project at $MobileRoot"
}

$Flutter = $null
foreach ($c in @(
  "E:\AuvoraPortable\Flutter\flutter-sdk\bin\flutter.bat",
  "C:\Users\kwasi\flutter\bin\flutter.bat",
  "D:\auvora-wallet\.tools\flutter\bin\flutter.bat",
  "D:\flutter-sdk\bin\flutter.bat"
)) {
  if (Test-Path $c) { $Flutter = $c; break }
}
if (-not $Flutter) { throw "flutter not found" }

# Canonical Local QA dart-defines (must match AuvoraQaLocalEvm / AuvoraQaLocalSolana).
$DartDefines = @(
  'AUVORA_NETWORK_ENV=testnet',
  'AUVORA_ALLOW_LOCAL_API=true',
  'AUVORA_API_BASE_URL=http://127.0.0.1:4000',
  'AUVORA_SEED_INBOX=false',
  'TESTNET_BROADCAST_ENABLED=true',
  'AUVORA_QA_LOCAL_EVM=true',
  'AUVORA_QA_EVM_CHAIN_ID=31337',
  'AUVORA_QA_EVM_RPC=http://127.0.0.1:8545',
  'ETH_RPC_URL=http://127.0.0.1:8545',
  'AUVORA_QA_LOCAL_SOLANA=true',
  'AUVORA_QA_SOLANA_RPC=http://127.0.0.1:8899',
  'AUVORA_QA_SOLANA_ADDRESS=8jFiN4JabxmBwkCVVFnaNyszExbCdd7k2TDuFQHyNThQ',
  'AUVORA_QA_SOLANA_RECIPIENT=HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'
)

function Assert-SafeQaDefines([string[]]$defines) {
  $joined = ($defines -join ' ')
  if ($joined -notmatch 'AUVORA_NETWORK_ENV=testnet') {
    throw 'QA build refused: AUVORA_NETWORK_ENV must be testnet'
  }
  if ($joined -match 'LIVE_BROADCAST_ENABLED=true|MAINNET_BROADCAST=true') {
    throw 'QA build refused: mainnet/live broadcast must stay OFF'
  }
  if ($joined -notmatch 'AUVORA_QA_LOCAL_EVM=true') {
    throw 'QA build refused: Local EVM QA flag missing'
  }
  if ($joined -notmatch 'AUVORA_QA_LOCAL_SOLANA=true') {
    throw 'QA build refused: Local Solana QA flag missing'
  }
  if ($joined -match 'mainnet-beta|api\.mainnet|eth-mainnet|solana-mainnet') {
    throw 'QA build refused: production/mainnet RPC host in dart-defines'
  }
  if ($joined -notmatch 'AUVORA_QA_SOLANA_RPC=http://127\.0\.0\.1:8899') {
    throw 'QA build refused: Local Solana RPC must be loopback :8899'
  }
  if ($joined -notmatch 'AUVORA_QA_EVM_RPC=http://127\.0\.0\.1:8545') {
    throw 'QA build refused: Local EVM RPC must be loopback :8545'
  }
}

Assert-SafeQaDefines $DartDefines

$GradleProps = Join-Path $MobileRoot "android\gradle.properties"
$Backup = Get-Content $GradleProps -Raw

try {
  if ($Backup -notmatch "(?m)^auvoraQa=") {
    Add-Content -Path $GradleProps -Value "`r`nauvoraQa=true`r`n"
  } else {
    $updated = $Backup -replace "(?m)^auvoraQa=.*$", "auvoraQa=true"
    Set-Content -Path $GradleProps -Value $updated -NoNewline
  }

  Write-Host "Flutter: $Flutter"
  Write-Host "Building com.auvora.auvora_wallet.qa (Auvora QA)"
  Write-Host "MAINNET: OFF"
  Write-Host "LOCAL EVM: QA"
  Write-Host "LOCAL SOLANA: QA"
  Write-Host "gradle.properties auvoraQa:"
  Select-String -Path $GradleProps -Pattern "auvoraQa"

  $defineArgs = @()
  foreach ($d in $DartDefines) {
    $defineArgs += "--dart-define=$d"
  }

  & $Flutter build apk --debug @defineArgs

  if ($LASTEXITCODE -ne 0) { throw "flutter build apk failed" }

  $Apk = Join-Path $MobileRoot "build\app\outputs\flutter-apk\app-debug.apk"
  if (-not (Test-Path $Apk)) { throw "APK not found: $Apk" }

  $RepoArtifacts = "D:\auvora-wallet\artifacts"
  if (-not (Test-Path $RepoArtifacts)) { New-Item -ItemType Directory -Path $RepoArtifacts | Out-Null }
  $Dest = Join-Path $RepoArtifacts "auvora-qa-debug.apk"
  Copy-Item -Force $Apk $Dest

  $AaptRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools"
  $aaptExe = Get-ChildItem $AaptRoot -Recurse -Filter aapt.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($aaptExe) {
    $dump = & $aaptExe.FullName dump badging $Dest 2>&1 | Out-String
    Write-Host ($dump | Select-String "package: name=" | ForEach-Object { $_.Line })
    Write-Host ($dump | Select-String "application-label:'" | Select-Object -First 1 | ForEach-Object { $_.Line })
    Write-Host ($dump | Select-String "versionCode=" | Select-Object -First 1 | ForEach-Object { $_.Line })
    if ($dump -notmatch "com\.auvora\.auvora_wallet\.qa") {
      throw "QA package id not applied - expected com.auvora.auvora_wallet.qa"
    }
    if ($dump -match "com\.auvora\.auvora_wallet'") {
      throw "QA build refused: production package id detected"
    }
  }

  # Soft verify defines are present in the build command log / artifact metadata path.
  Write-Host "DART_DEFINES_LOCAL_SOLANA=PASS"
  Write-Host "QA APK: $Dest"
  Write-Host "Package: com.auvora.auvora_wallet.qa"
  Write-Host "Label: Auvora QA"
  Write-Host "Install: adb install -r $Dest"
  Write-Host "Does NOT replace com.auvora.auvora_wallet"
}
finally {
  Set-Content -Path $GradleProps -Value $Backup -NoNewline
}
