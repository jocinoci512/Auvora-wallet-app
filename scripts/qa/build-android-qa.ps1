# Canonical Auvora Android QA APK build (Local EVM + Local Solana).
# LOCAL QA ONLY — wraps apps/mobile/android/scripts/build-qa.ps1
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '..\..\apps\mobile\android\scripts\build-qa.ps1'
if (-not (Test-Path $script)) { throw "Missing build script: $script" }
powershell -NoProfile -ExecutionPolicy Bypass -File $script @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
