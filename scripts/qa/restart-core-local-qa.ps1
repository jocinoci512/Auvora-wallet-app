$ErrorActionPreference = 'Continue'
$log = 'D:\auvora-wallet\.stack-restart.txt'
'' | Set-Content $log

# LOCAL QA ONLY — loopback ports + scripts/cloud/with-env.mjs (loads repo .env, never production).

function Wait-HttpOk([string]$url, [int]$seconds = 90) {
  for ($i = 0; $i -lt [math]::Ceiling($seconds / 2); $i++) {
    try {
      $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { return $true }
    } catch {}
    Start-Sleep -Seconds 2
  }
  return $false
}

function Start-Svc([string]$name, [string[]]$nodeArgs, [hashtable]$extraEnv) {
  foreach ($k in $extraEnv.Keys) { Set-Item -Path "Env:$k" -Value $extraEnv[$k] }
  $env:NODE_ENV = 'development'
  if (-not $env:NODE_OPTIONS) { $env:NODE_OPTIONS = '--max-old-space-size=512' }
  Start-Process -FilePath 'node' -ArgumentList $nodeArgs -WorkingDirectory 'D:\auvora-wallet' -WindowStyle Hidden | Out-Null
  Add-Content $log "started $name"
}

# Notifications (optional dep for auth mail driver) — local only
try { Invoke-WebRequest 'http://127.0.0.1:3006/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'notifications already up' } catch {
  Start-Svc 'notifications' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/notifications-service','dev') @{
    PORT = '3006'
    NODE_OPTIONS = '--max-old-space-size=512'
  }
  if (Wait-HttpOk 'http://127.0.0.1:3006/health' 90) { Add-Content $log 'notifications UP' } else { Add-Content $log 'notifications FAIL (non-blocking)' }
}

# Auth
try { Invoke-WebRequest 'http://127.0.0.1:4001/ready' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'auth already ready' } catch {
  Start-Svc 'auth' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/auth-service','dev') @{
    PORT = '4001'
    NODE_OPTIONS = '--max-old-space-size=768'
    MAIL_DRIVER = 'notifications'
    NOTIFICATIONS_SERVICE_URL = 'http://127.0.0.1:3006'
    APP_PUBLIC_URL = 'http://localhost:3000'
  }
  if (Wait-HttpOk 'http://127.0.0.1:4001/ready' 120) { Add-Content $log 'auth UP' } else { Add-Content $log 'auth FAIL' }
}

# Wallet
try { Invoke-WebRequest 'http://127.0.0.1:3002/ready' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'wallet already ready' } catch {
  Start-Svc 'wallet' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/wallet-service','dev') @{
    PORT = '3002'
    NODE_OPTIONS = '--max-old-space-size=768'
  }
  if (Wait-HttpOk 'http://127.0.0.1:3002/ready' 120) { Add-Content $log 'wallet UP' } else { Add-Content $log 'wallet FAIL' }
}

# Connections
try { Invoke-WebRequest 'http://127.0.0.1:3016/ready' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'connections already ready' } catch {
  Start-Svc 'connections' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/connections-service','dev') @{
    PORT = '3016'
    NODE_OPTIONS = '--max-old-space-size=512'
  }
  if (Wait-HttpOk 'http://127.0.0.1:3016/ready' 120) { Add-Content $log 'connections UP' } else { Add-Content $log 'connections FAIL' }
}

# Gateway
try { Invoke-WebRequest 'http://127.0.0.1:4000/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'gateway already up' } catch {
  Start-Svc 'gateway' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/gateway-service','dev') @{
    PORT = '4000'
    NODE_OPTIONS = '--max-old-space-size=768'
  }
  if (Wait-HttpOk 'http://127.0.0.1:4000/health' 120) { Add-Content $log 'gateway UP' } else { Add-Content $log 'gateway FAIL' }
}

# Wait for gateway ready (auth upstream required)
if (Wait-HttpOk 'http://127.0.0.1:4000/ready' 60) { Add-Content $log 'gateway READY' } else { Add-Content $log 'gateway READY FAIL' }

# Web
try { Invoke-WebRequest 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2 | Out-Null; Add-Content $log 'web already up' } catch {
  Start-Svc 'web' @('scripts/cloud/with-env.mjs','pnpm','--filter','@auvora/web','dev') @{
    NODE_OPTIONS = '--max-old-space-size=768'
  }
  if (Wait-HttpOk 'http://127.0.0.1:3000' 120) { Add-Content $log 'web UP' } else { Add-Content $log 'web FAIL' }
}

foreach ($u in @(
  'http://127.0.0.1:4001/ready',
  'http://127.0.0.1:3002/ready',
  'http://127.0.0.1:3016/ready',
  'http://127.0.0.1:3006/health',
  'http://127.0.0.1:4000/health',
  'http://127.0.0.1:4000/ready',
  'http://127.0.0.1:3000'
)) {
  try {
    $r = Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 5
    Add-Content $log "final $u $($r.StatusCode)"
  } catch {
    $code = $null
    try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    if ($code) { Add-Content $log "final $u HTTP $code" } else { Add-Content $log "final $u DOWN" }
  }
}
