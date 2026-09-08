# Build side-by-side Auvora Staging APK (com.auvora.auvora_wallet.staging)
# Does NOT overwrite com.auvora.auvora_wallet or com.auvora.auvora_wallet.qa
#
# Usage:
#   powershell -File apps/mobile/android/scripts/build-staging.ps1

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

$GatewayUrl = if ($env:AUVORA_STAGING_GATEWAY_URL) {
  $env:AUVORA_STAGING_GATEWAY_URL
} else {
  "https://gateway-production-bc6a.up.railway.app"
}

# Canonical Staging dart-defines (targets public testnets, never local Anvil / local Solana).
$DartDefines = @(
  'AUVORA_NETWORK_ENV=testnet',
  'AUVORA_ALLOW_LOCAL_API=false',
  "AUVORA_API_BASE_URL=$GatewayUrl",
  'AUVORA_SEED_INBOX=false',
  'TESTNET_BROADCAST_ENABLED=true',
  'AUVORA_QA_LOCAL_EVM=false',
  'AUVORA_QA_LOCAL_SOLANA=false'
)

function Assert-SafeStagingDefines([string[]]$defines) {
  $joined = ($defines -join ' ')
  if ($joined -notmatch 'AUVORA_NETWORK_ENV=testnet') {
    throw 'Staging build refused: AUVORA_NETWORK_ENV must be testnet'
  }
  if ($joined -match 'LIVE_BROADCAST_ENABLED=true|MAINNET_BROADCAST=true') {
    throw 'Staging build refused: mainnet/live broadcast must stay OFF'
  }
  if ($joined -match 'AUVORA_QA_LOCAL_EVM=true') {
    throw 'Staging build refused: Local EVM QA must be disabled in staging'
  }
  if ($joined -match 'AUVORA_QA_LOCAL_SOLANA=true') {
    throw 'Staging build refused: Local Solana QA must be disabled in staging'
  }
  if ($joined -match '127\.0\.0\.1|localhost') {
    throw 'Staging build refused: staging must not target loopback endpoints'
  }
}

Assert-SafeStagingDefines $DartDefines

$GradleProps = Join-Path $MobileRoot "android\gradle.properties"
$Backup = Get-Content $GradleProps -Raw

try {
  # Set auvoraStaging=true and auvoraQa=false
  $content = $Backup
  if ($content -notmatch "(?m)^auvoraStaging=") {
    $content = "$content`r`nauvoraStaging=true`r`n"
  } else {
    $content = $content -replace "(?m)^auvoraStaging=.*$", "auvoraStaging=true"
  }
  if ($content -notmatch "(?m)^auvoraQa=") {
    $content = "$content`r`nauvoraQa=false`r`n"
  } else {
    $content = $content -replace "(?m)^auvoraQa=.*$", "auvoraQa=false"
  }
  Set-Content -Path $GradleProps -Value $content -NoNewline

  Write-Host "Flutter: $Flutter"
  Write-Host "Building com.auvora.auvora_wallet.staging (Auvora Staging)"
  Write-Host "MAINNET: OFF"
  Write-Host "PUBLIC TESTNETS: Sepolia, Amoy, BSC Testnet, Devnet, Testnet3, Nile"
  Write-Host "ENDPOINT: https://api-staging.auvorawallet.com"

  $defineArgs = @()
  foreach ($d in $DartDefines) {
    $defineArgs += "--dart-define=$d"
  }

  & $Flutter build apk --debug @defineArgs
  if ($LASTEXITCODE -ne 0) { throw "flutter build failed" }

  $src = Join-Path $MobileRoot "build\app\outputs\flutter-apk\app-debug.apk"
  $dst = Join-Path $MobileRoot "build\app\outputs\flutter-apk\app-staging.apk"
  if (Test-Path $src) {
    Copy-Item $src $dst -Force
    Write-Host "Staging APK ready at: $dst"
  }

  $RepoArtifacts = "E:\AuvoraPortable\Project\auvora-wallet\artifacts"
  if (-not (Test-Path $RepoArtifacts)) { New-Item -ItemType Directory -Path $RepoArtifacts | Out-Null }
  $StagingArtifact = Join-Path $RepoArtifacts "auvora-staging-debug.apk"
  if (Test-Path $src) {
    Copy-Item -Force $src $StagingArtifact
    Write-Host "Staging Artifact copied to: $StagingArtifact"
  }
} finally {
  Set-Content -Path $GradleProps -Value $Backup -NoNewline
}
