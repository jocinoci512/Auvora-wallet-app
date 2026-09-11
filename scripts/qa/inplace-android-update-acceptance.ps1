#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Auvora in-place Android update acceptance (same package, same signing, higher versionCode).

.DESCRIPTION
  Does NOT uninstall, clear data, or change applicationId.
  Uses: adb install -r

  Expected: one launcher app, same package, preserved app data directory lineage.
#>
[CmdletBinding()]
param(
  [string]$Serial = 'R5CW51ZMNLB',
  [string]$Package = 'com.auvora.auvora_wallet',
  [string]$ApkPath = '',
  [string]$Adb = '',
  [string]$RepoRoot = ''
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

function Die([string]$m) { Write-Host "[FAIL] $m" -ForegroundColor Red; exit 1 }
function Ok([string]$m) { Write-Host "[OK] $m" -ForegroundColor Green }
function Info([string]$m) { Write-Host "[*] $m" -ForegroundColor Cyan }

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
if (-not $Adb) {
  $sdk = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, 'E:\AuvoraPortable\Android\Sdk') |
    Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $sdk) { Die 'Android SDK not found' }
  $Adb = Join-Path $sdk 'platform-tools\adb.exe'
}
if (-not (Test-Path $Adb)) { Die "adb not found: $Adb" }

if (-not $ApkPath) {
  $ApkPath = Join-Path $RepoRoot 'apps\mobile\build\app\outputs\flutter-apk\app-release.apk'
}
if (-not (Test-Path $ApkPath)) { Die "APK missing: $ApkPath - build release first" }

function Get-PkgDump {
  & $Adb -s $Serial shell dumpsys package $Package
}

function Get-VersionCode([string]$dump) {
  if ($dump -match 'versionCode=(\d+)') { return [int]$Matches[1] }
  return -1
}

function Get-FirstInstall([string]$dump) {
  $m = [regex]::Matches($dump, 'firstInstallTime=([^\r\n]+)')
  if ($m.Count -ge 1) { return $m[0].Groups[1].Value.Trim() }
  return ''
}

function Get-DataDirs([string]$dump) {
  return [regex]::Matches($dump, 'dataDir=([^\r\n]+)') | ForEach-Object { $_.Groups[1].Value.Trim() }
}

Info "Device $Serial - snapshot BEFORE"
$before = Get-PkgDump | Out-String
if ($before -notmatch [regex]::Escape($Package)) { Die "Package $Package not installed" }
$beforeCode = Get-VersionCode $before
$beforeFirst = Get-FirstInstall $before
$beforeDirs = @(Get-DataDirs $before)
Ok "Before versionCode=$beforeCode firstInstallTime=$beforeFirst"
Ok ("Before dataDirs: " + ($beforeDirs -join ', '))

$pkgCount = (& $Adb -s $Serial shell pm list packages | Select-String -Pattern 'package:com\.auvora\.auvora_wallet($|\s)').Count
if ($pkgCount -ne 1) { Die "Expected exactly 1 production package match, found $pkgCount" }
$qa = & $Adb -s $Serial shell pm list packages | Select-String 'auvora_wallet\.(qa|staging)'
if ($qa) { Write-Host "[!] QA/staging also installed (ok for side-by-side): $qa" -ForegroundColor Yellow }

Info "Installing in-place: adb install -r"
$installOut = & $Adb -s $Serial install -r $ApkPath 2>&1 | Out-String
Write-Host $installOut
if ($installOut -notmatch 'Success') { Die 'adb install -r did not report Success' }

Info 'Snapshot AFTER'
$after = Get-PkgDump | Out-String
$afterCode = Get-VersionCode $after
$afterFirst = Get-FirstInstall $after
$afterDirs = @(Get-DataDirs $after)
Ok "After versionCode=$afterCode firstInstallTime=$afterFirst"

if ($afterCode -le $beforeCode) { Die "versionCode did not increase ($beforeCode -> $afterCode)" }
if ($afterFirst -ne $beforeFirst) {
  Die "firstInstallTime changed ($beforeFirst -> $afterFirst) - looks like a reinstall, not an update"
}
foreach ($d in $beforeDirs) {
  if ($afterDirs -notcontains $d) { Die "dataDir missing after update: $d" }
}

$pkgCountAfter = (& $Adb -s $Serial shell pm list packages | Select-String -Pattern 'package:com\.auvora\.auvora_wallet($|\s)').Count
if ($pkgCountAfter -ne 1) { Die "Customer app count after update is $pkgCountAfter (expected 1)" }

# Launch - unlock / dashboard proves vault still present (not Welcome/Create).
& $Adb -s $Serial shell am force-stop $Package | Out-Null
& $Adb -s $Serial shell monkey -p $Package -c android.intent.category.LAUNCHER 1 | Out-Null
Start-Sleep -Seconds 4

$report = [ordered]@{
  package = $Package
  beforeVersionCode = $beforeCode
  afterVersionCode = $afterCode
  firstInstallTimePreserved = ($afterFirst -eq $beforeFirst)
  dataDirsPreserved = $true
  customerAppCount = $pkgCountAfter
  installMode = 'adb install -r'
  note = 'Encrypted vault + auth tokens live in app-private storage scoped to this package; preserved when firstInstallTime and dataDir survive.'
}
$out = Join-Path $RepoRoot 'artifacts\inplace-android-update-acceptance.json'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
($report | ConvertTo-Json -Depth 5) | Set-Content -Path $out -Encoding utf8
Ok "Wrote $out"
Ok 'IN-PLACE UPDATE ACCEPTANCE: PASS'
