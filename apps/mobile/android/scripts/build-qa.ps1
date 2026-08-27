# Build side-by-side Auvora QA APK (does NOT overwrite com.auvora.auvora_wallet)
#
# Usage:
#   powershell -File apps/mobile/android/scripts/build-qa.ps1

$ErrorActionPreference = "Stop"
$MobileRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $MobileRoot
if (-not (Test-Path (Join-Path $MobileRoot "pubspec.yaml"))) {
  throw "Expected Flutter project at $MobileRoot"
}

$Flutter = $null
foreach ($c in @(
  "C:\Users\kwasi\flutter\bin\flutter.bat",
  "D:\auvora-wallet\.tools\flutter\bin\flutter.bat",
  "D:\flutter-sdk\bin\flutter.bat"
)) {
  if (Test-Path $c) { $Flutter = $c; break }
}
if (-not $Flutter) { throw "flutter not found" }

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
  Write-Host "gradle.properties auvoraQa:"
  Select-String -Path $GradleProps -Pattern "auvoraQa"

  & $Flutter build apk --debug `
    --dart-define=AUVORA_NETWORK_ENV=testnet `
    --dart-define=AUVORA_ALLOW_LOCAL_API=true `
    --dart-define=AUVORA_API_BASE_URL=http://127.0.0.1:4000 `
    --dart-define=AUVORA_SEED_INBOX=false

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
    if ($dump -notmatch "com\.auvora\.auvora_wallet\.qa") {
      throw "QA package id not applied - expected com.auvora.auvora_wallet.qa"
    }
  }

  Write-Host "QA APK: $Dest"
  Write-Host "Package: com.auvora.auvora_wallet.qa"
  Write-Host "Label: Auvora QA"
  Write-Host "Install: adb install -r $Dest"
  Write-Host "Does NOT replace com.auvora.auvora_wallet"
}
finally {
  Set-Content -Path $GradleProps -Value $Backup -NoNewline
}
