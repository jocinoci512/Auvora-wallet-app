# Build ecosystem device-test APK (Alchemy/Reown/one-account state).
# Loads WC_PROJECT_ID from root .env without printing the value.
# NEVER inject ALCHEMY_API_KEY into the APK.

$ErrorActionPreference = 'Stop'
$Root = 'D:\auvora-wallet'
$Mobile = Join-Path $Root 'apps\mobile'
$Flutter = 'C:\Users\kwasi\flutter\bin\flutter.bat'
$Dist = 'D:\auvora-build\dist\ecosystem-test'
$Temp = 'D:\auvora-build\temp'
$GradleHome = 'D:\auvora-build\gradle-home'
$DestName = 'auvora-wallet-ecosystem-test.apk'

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
$dest = Join-Path $Dist $DestName
Copy-Item -LiteralPath $built -Destination $dest -Force

$hash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $dest).Length
$versionLine = (Select-String -Path (Join-Path $Mobile 'pubspec.yaml') -Pattern '^version:\s*(.+)$').Matches[0].Groups[1].Value.Trim()

$signing = 'debug keystore (Alpha / sideload)'
$gradleKts = Join-Path $Mobile 'android\app\build.gradle.kts'
$keyProps = Join-Path $Mobile 'android\key.properties'
if (Test-Path -LiteralPath $keyProps) {
  $signing = 'release keystore (android/key.properties present)'
} elseif (Test-Path -LiteralPath $gradleKts) {
  $gk = Get-Content -LiteralPath $gradleKts -Raw
  if ($gk -match 'hasReleaseKeystore' -and -not (Test-Path -LiteralPath $keyProps)) {
    $signing = 'debug keystore (Alpha / sideload; key.properties absent)'
  }
}

Write-Output "APK_PATH=$dest"
Write-Output "APK_SIZE_BYTES=$size"
Write-Output "APK_SHA256=$hash"
Write-Output "APK_VERSION=$versionLine"
Write-Output "SIGNING=$signing"
