$ErrorActionPreference = 'Continue'
$out = 'D:\auvora-wallet\.disk2.txt'
$freeC = [math]::Round((Get-PSDrive C).Free / 1MB)
$freeD = [math]::Round((Get-PSDrive D).Free / 1MB)
@(
  "C_free_MB=$freeC",
  "D_free_MB=$freeD"
) | Set-Content -Path $out -Encoding ascii

foreach ($u in @(
  'http://127.0.0.1:4000/health',
  'http://127.0.0.1:4001/health',
  'http://127.0.0.1:3002/health',
  'http://127.0.0.1:3016/health',
  'http://127.0.0.1:3000'
)) {
  try {
    $r = Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 3
    Add-Content $out "$u $($r.StatusCode)"
  } catch {
    Add-Content $out "$u DOWN"
  }
}

$webDown = $true
try {
  Invoke-WebRequest 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2 | Out-Null
  $webDown = $false
} catch {}

if ($webDown) {
  $env:NODE_ENV = 'development'
  $env:NODE_OPTIONS = '--max-old-space-size=768'
  Start-Process -FilePath 'node' -ArgumentList @(
    'scripts/cloud/with-env.mjs', 'pnpm', '--filter', '@auvora/web', 'dev'
  ) -WorkingDirectory 'D:\auvora-wallet' -WindowStyle Hidden
  Add-Content $out 'web_restarting'
}

$connDown = $true
try {
  Invoke-WebRequest 'http://127.0.0.1:3016/health' -UseBasicParsing -TimeoutSec 2 | Out-Null
  $connDown = $false
} catch {}

if ($connDown -and ($freeC -ge 400 -or $freeD -ge 400)) {
  $env:PORT = '3016'
  $env:NODE_ENV = 'development'
  $env:NODE_OPTIONS = '--max-old-space-size=512'
  Start-Process -FilePath 'node' -ArgumentList @(
    'scripts/cloud/with-env.mjs', 'pnpm', '--filter', '@auvora/connections-service', 'dev'
  ) -WorkingDirectory 'D:\auvora-wallet' -WindowStyle Hidden
  Add-Content $out 'connections_restarting'
}

Start-Sleep -Seconds 25

foreach ($u in @('http://127.0.0.1:3000', 'http://127.0.0.1:3016/health')) {
  try {
    $r = Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 5
    Add-Content $out "after $u $($r.StatusCode)"
  } catch {
    Add-Content $out "after $u DOWN"
  }
}
