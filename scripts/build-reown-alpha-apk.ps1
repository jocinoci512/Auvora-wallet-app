# Load WC_PROJECT_ID from root .env without printing the value.
# Build Alpha APK with dart-define for Reown (Project ID is client-public).
# NEVER inject ALCHEMY_API_KEY.

$ErrorActionPreference = 'Stop'
$Root = 'D:\auvora-wallet'
$Mobile = Join-Path $Root 'apps\mobile'
$Flutter = 'C:\Users\kwasi\flutter\bin\flutter.bat'
$Dist = 'D:\auvora-build\dist\reown-alpha'
$Temp = 'D:\auvora-build\temp'
$GradleHome = 'D:\auvora-build\gradle-home'

New-Item -ItemType Directory -Force -Path $Dist | Out-Null
New-Item -ItemType Directory -Force -Path $Temp | Out-Null
New-Item -ItemType Directory -Force -Path $GradleHome | Out-Null

$env:TEMP = $Temp
$env:TMP = $Temp
$env:GRADLE_USER_HOME = $GradleHome

$wcProjectId = $null
$envFile = Join-Path $Root '.env'
if (Test-Path -LiteralPath $envFile) {
  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*WC_PROJECT_ID\s*=\s*(.+)$' -and $line -notmatch '^\s*#') {
      $wcProjectId = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}

if ([string]::IsNullOrWhiteSpace($wcProjectId)) {
  Write-Error 'WC_PROJECT_ID missing from root .env — refusing APK build without Project ID.'
  exit 1
}

Write-Output 'WC_PROJECT_ID_PRESENT=True'
Write-Output 'ALCHEMY_DART_DEFINE=NOT_INJECTED'

Set-Location $Mobile
& $Flutter build apk --release --dart-define="WC_PROJECT_ID=$wcProjectId"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$built = Join-Path $Mobile 'build\app\outputs\flutter-apk\app-release.apk'
$dest = Join-Path $Dist 'auvora-wallet-reown-alpha.apk'
Copy-Item -LiteralPath $built -Destination $dest -Force

$hash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $dest).Length
Write-Output "APK_PATH=$dest"
Write-Output "APK_SIZE_BYTES=$size"
Write-Output "APK_SHA256=$hash"
Write-Output 'APK_VERSION=1.0.0-alpha.1+5'
Write-Output 'SIGNING=Flutter debug/release keystore as configured in android/app'
