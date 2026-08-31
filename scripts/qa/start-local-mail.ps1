# Start Mailpit (Docker profile mail) + local HTTP→SMTP bridge for Notifications.
# LOCAL QA ONLY.

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Compose = Join-Path $RepoRoot 'docker-compose.yml'
$BridgePort = if ($env:AUVORA_QA_MAIL_BRIDGE_PORT) { $env:AUVORA_QA_MAIL_BRIDGE_PORT } else { '3099' }
$PidFile = Join-Path $RepoRoot 'artifacts\mailpit-bridge.pid'

Push-Location $RepoRoot
try {
  docker compose -f $Compose --profile mail up -d mailpit
} finally {
  Pop-Location
}

$ok = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $r = Invoke-WebRequest 'http://127.0.0.1:8025/api/v1/info' -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $ok) { throw 'Mailpit UI did not become healthy on :8025' }

New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot 'artifacts') | Out-Null
if (Test-Path $PidFile) {
  $old = Get-Content $PidFile -ErrorAction SilentlyContinue
  if ($old) { Stop-Process -Id ([int]$old) -Force -ErrorAction SilentlyContinue }
}

$node = (Get-Command node).Source
$bridge = Join-Path $RepoRoot 'scripts\qa\mailpit-email-bridge.mjs'
$proc = Start-Process -FilePath $node -ArgumentList @($bridge) -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru
Set-Content -Path $PidFile -Value $proc.Id

$bridgeOk = $false
for ($i = 0; $i -lt 15; $i++) {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:$BridgePort/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $bridgeOk = $true; break }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $bridgeOk) { throw "Mailpit email bridge failed on :$BridgePort" }

Write-Host 'MAILPIT:        HEALTHY  http://127.0.0.1:8025'
Write-Host "SMTP:           HEALTHY  127.0.0.1:1025"
Write-Host "EMAIL BRIDGE:   HEALTHY  http://127.0.0.1:$BridgePort/send"
Write-Host "Set NOTIFICATIONS_EMAIL_PROVIDER_URL=http://127.0.0.1:$BridgePort/send for Notifications EMAIL."
