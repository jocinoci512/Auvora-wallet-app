# One-command Auvora Local QA lab bootstrap.
# Starts/checks Docker data plane, Mailpit, Local EVM, core HTTP services, adb reverse.
# LOCAL QA ONLY — does not deploy, push, or touch production.

$ErrorActionPreference = 'Continue'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$log = Join-Path $RepoRoot 'artifacts\qa-lab-start.txt'
New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot 'artifacts') | Out-Null
'' | Set-Content $log

function Wait-HttpOk([string]$url, [int]$seconds = 60) {
  for ($i = 0; $i -lt [math]::Ceiling($seconds / 2); $i++) {
    try {
      $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { return $true }
    } catch {}
    Start-Sleep -Seconds 2
  }
  return $false
}

function Stop-StaleQaService([string]$pattern) {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match $pattern) } |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      Add-Content $log "killed stale PID $($_.ProcessId) matching $pattern"
    }
}

function Start-Svc([string]$name, [string[]]$nodeArgs, [hashtable]$extraEnv) {
  foreach ($k in $extraEnv.Keys) { Set-Item -Path "Env:$k" -Value $extraEnv[$k] }
  $env:NODE_ENV = 'development'
  if (-not $env:NODE_OPTIONS) { $env:NODE_OPTIONS = '--max-old-space-size=512' }
  Start-Process -FilePath 'node' -ArgumentList $nodeArgs -WorkingDirectory $RepoRoot -WindowStyle Hidden | Out-Null
  Add-Content $log "started $name"
}

Write-Host '=== AUVORA QA LAB START ==='

# Docker data plane — wait until Postgres accepts connections before Nest/Prisma boots
Push-Location $RepoRoot
try {
  docker compose up -d postgres redis | Out-Null
} finally { Pop-Location }
$pgOk = $false
for ($i = 0; $i -lt 30; $i++) {
  docker exec auvora-postgres pg_isready -U auvora -d auvora_wallet 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $pgOk = $true; break }
  Start-Sleep -Seconds 2
}
if ($pgOk) { Add-Content $log 'postgres ready' } else { Add-Content $log 'postgres NOT ready' }

# Local EVM + Local Solana + Mail
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-local-evm.ps1')
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'fund-local-wallet.ps1')
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-local-solana.ps1')
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'fund-local-solana-wallet.ps1')
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-local-mail.ps1')

$bridgeUrl = 'http://127.0.0.1:3099/send'

# Notifications with Mailpit bridge
try { Invoke-WebRequest 'http://127.0.0.1:3006/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'notifications already up' } catch {
  Stop-StaleQaService 'notifications-service|services[\\/]notifications'
  Start-Svc 'notifications' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/notifications-service','dev') @{
    PORT = '3006'
    NODE_OPTIONS = '--max-old-space-size=768'
    NOTIFICATIONS_SIMULATOR_ENABLED = 'false'
    NOTIFICATIONS_EMAIL_PROVIDER_URL = $bridgeUrl
    NOTIFICATIONS_CHANNEL_EMAIL_ENABLED = 'true'
    AUVORA_QA_ALLOW_EMAIL_REPLAY = 'true'
  }
  if (Wait-HttpOk 'http://127.0.0.1:3006/health' 90) { Add-Content $log 'notifications UP' } else { Add-Content $log 'notifications FAIL' }
}

# Auth → notifications durable mail path + optional SMTP to Mailpit for critical-path
try { Invoke-WebRequest 'http://127.0.0.1:4001/ready' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'auth already ready' } catch {
  Start-Svc 'auth' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/auth-service','dev') @{
    PORT = '4001'
    NODE_OPTIONS = '--max-old-space-size=768'
    MAIL_DRIVER = 'smtp'
    SMTP_HOST = '127.0.0.1'
    SMTP_PORT = '1025'
    SMTP_FROM = 'noreply@auvora.local'
    SMTP_FROM_NAME = 'Auvora Wallet QA'
    NOTIFICATIONS_SERVICE_URL = 'http://127.0.0.1:3006'
    APP_PUBLIC_URL = 'http://localhost:3000'
  }
  if (Wait-HttpOk 'http://127.0.0.1:4001/ready' 120) { Add-Content $log 'auth UP' } else { Add-Content $log 'auth FAIL' }
}

foreach ($pair in @(
  @{ Name='wallet'; Port='3002'; Filter='@auvora/wallet-service' },
  @{ Name='compliance'; Port='3005'; Filter='@auvora/compliance-service' },
  @{ Name='connections'; Port='3016'; Filter='@auvora/connections-service' }
)) {
  $url = "http://127.0.0.1:$($pair.Port)/ready"
  try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log "$($pair.Name) already ready" } catch {
    Start-Svc $pair.Name @('scripts/cloud/with-env.mjs','pnpm','--filter',$pair.Filter,'dev') @{
      PORT = $pair.Port
      NODE_OPTIONS = '--max-old-space-size=768'
    }
    if (Wait-HttpOk $url 120) { Add-Content $log "$($pair.Name) UP" } else { Add-Content $log "$($pair.Name) FAIL" }
  }
}

try { Invoke-WebRequest 'http://127.0.0.1:4000/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'gateway already up' } catch {
  Start-Svc 'gateway' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/gateway-service','dev') @{
    PORT = '4000'
    NODE_OPTIONS = '--max-old-space-size=768'
  }
  if (Wait-HttpOk 'http://127.0.0.1:4000/health' 120) { Add-Content $log 'gateway UP' } else { Add-Content $log 'gateway FAIL' }
}
[void](Wait-HttpOk 'http://127.0.0.1:4000/ready' 60)

try { Invoke-WebRequest 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'web already up' } catch {
  Start-Svc 'web' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/web','dev') @{
    NODE_OPTIONS = '--max-old-space-size=768'
  }
  if (Wait-HttpOk 'http://127.0.0.1:3000/health' 180) { Add-Content $log 'web UP' } else { Add-Content $log 'web FAIL' }
}
try { Invoke-WebRequest 'http://127.0.0.1:3001' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'admin already up' } catch {
  Start-Svc 'admin' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/admin','dev') @{
    NODE_OPTIONS = '--max-old-space-size=768'
  }
  if (Wait-HttpOk 'http://127.0.0.1:3001' 180) { Add-Content $log 'admin UP' } else { Add-Content $log 'admin FAIL' }
}

# ADB reverse when Samsung is attached
$adb = 'D:\Android\Sdk\platform-tools\adb.exe'
if (Test-Path $adb) {
  $devs = & $adb devices
  if ($devs -match 'R5CW51ZMNLB\s+device') {
    & $adb -s R5CW51ZMNLB reverse tcp:4000 tcp:4000 | Out-Null
    & $adb -s R5CW51ZMNLB reverse tcp:8545 tcp:8545 | Out-Null
    & $adb -s R5CW51ZMNLB reverse tcp:8899 tcp:8899 | Out-Null
    Add-Content $log 'adb reverse 4000+8545+8899 OK'
  }
}

Write-Host ''
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'check-auvora-qa-lab.ps1')
Write-Host "Log: $log"
