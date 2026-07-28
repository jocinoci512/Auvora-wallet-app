# Start local UI preview servers (web :3000, admin :3001).
# Usage from repo root:  .\scripts\start-previews.ps1
# Optional: .\scripts\start-previews.ps1 -Clean   # wipe .next caches first (fixes Internal Server Error after prod builds)
param(
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$env:Path = "$Root\.tools\pnpm;" + $env:Path
. "$Root\scripts\load-env.ps1" -Root $Root
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue

$logDir = Join-Path $Root '.local-data'
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

function Stop-ListenersOnPort([int]$Port) {
  $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }
    $procId = [int]$parts[-1]
    if ($procId -gt 0) {
      Write-Host "Stopping PID $procId on port $Port ..."
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Clear-NextCache([string]$AppRel) {
  $nextDir = Join-Path (Join-Path $Root $AppRel) '.next'
  if (Test-Path $nextDir) {
    Write-Host "Clearing $AppRel\.next ..."
    Remove-Item -Recurse -Force $nextDir
  }
}

function Test-NextCacheNeedsClean([string]$NextDir) {
  if (-not (Test-Path $NextDir)) { return $false }
  # Production `next build` always writes BUILD_ID; mixing that with `next dev` yields blank 500 pages.
  if (Test-Path (Join-Path $NextDir 'BUILD_ID')) { return $true }
  # Standalone / export leftovers without a healthy webpack or turbopack cache
  $hasWebpack = Test-Path (Join-Path $NextDir 'cache\webpack')
  $hasTurbopack = Test-Path (Join-Path $NextDir 'cache\turbopack')
  $hasDev = Test-Path (Join-Path $NextDir 'dev')
  $hasServer = Test-Path (Join-Path $NextDir 'server')
  if ($hasServer -and -not ($hasWebpack -or $hasTurbopack -or $hasDev)) { return $true }
  return $false
}

Write-Host "Freeing preview ports ..."
Stop-ListenersOnPort 3000
Stop-ListenersOnPort 3001
Start-Sleep -Seconds 1

$webNext = Join-Path $Root 'apps\web\.next'
$adminNext = Join-Path $Root 'apps\admin\.next'
$shouldClean = [bool]$Clean
if (-not $shouldClean) {
  if ((Test-NextCacheNeedsClean $webNext) -or (Test-NextCacheNeedsClean $adminNext)) {
    Write-Host "Detected production or stale .next artifacts - auto-cleaning for reliable next dev ..."
    $shouldClean = $true
  }
}

if ($shouldClean) {
  Clear-NextCache 'apps\web'
  Clear-NextCache 'apps\admin'
}

$pnpm = Join-Path $Root '.tools\pnpm\pnpm.exe'
if (-not (Test-Path $pnpm)) {
  throw "pnpm not found at $pnpm - run bootstrap or use PATH pnpm."
}
$webOut = Join-Path $logDir 'web-preview.out.log'
$webErr = Join-Path $logDir 'web-preview.err.log'
$adminOut = Join-Path $logDir 'admin-preview.out.log'
$adminErr = Join-Path $logDir 'admin-preview.err.log'
foreach ($f in @($webOut, $webErr, $adminOut, $adminErr)) {
  if (Test-Path $f) { Remove-Item -Force $f -ErrorAction SilentlyContinue }
}

Write-Host "Starting @auvora/web on http://127.0.0.1:3000 (0.0.0.0) ..."
Start-Process -FilePath $pnpm -ArgumentList '--filter','@auvora/web','dev' -WorkingDirectory $Root `
  -RedirectStandardOutput $webOut -RedirectStandardError $webErr -WindowStyle Hidden

Write-Host "Starting @auvora/admin on http://127.0.0.1:3001 (0.0.0.0) ..."
Start-Process -FilePath $pnpm -ArgumentList '--filter','@auvora/admin','dev' -WorkingDirectory $Root `
  -RedirectStandardOutput $adminOut -RedirectStandardError $adminErr -WindowStyle Hidden

function Wait-HttpOk([string]$Url, [int]$TimeoutSec = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      # Treat 5xx as not ready (stale .next / compile crash); 2xx-4xx mean the server is up.
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 800
      continue
    }
    Start-Sleep -Milliseconds 800
  }
  return $false
}

Write-Host "Waiting for servers to become ready ..."
$webOk = Wait-HttpOk 'http://127.0.0.1:3000/'
$adminOk = Wait-HttpOk 'http://127.0.0.1:3001/'

$urlsPath = Join-Path $logDir 'preview-urls.txt'
@(
  'Web:   http://127.0.0.1:3000/'
  'Web:   http://localhost:3000/'
  'Admin: http://127.0.0.1:3001/'
  'Admin: http://localhost:3001/'
) | Set-Content -Path $urlsPath -Encoding utf8

Write-Host ""
Write-Host "Previews:"
Write-Host "  Web   http://127.0.0.1:3000/   $(if ($webOk) { '[READY]' } else { '[NOT READY - see logs]' })"
Write-Host "  Web   http://localhost:3000/   $(if ($webOk) { '[READY]' } else { '[NOT READY]' })"
Write-Host "  Admin http://127.0.0.1:3001/   $(if ($adminOk) { '[READY]' } else { '[NOT READY - see logs]' })"
Write-Host "  Admin http://localhost:3001/   $(if ($adminOk) { '[READY]' } else { '[NOT READY]' })"
Write-Host "URL file: $urlsPath"
Write-Host "Logs: .local-data\web-preview.*.log / admin-preview.*.log"
Write-Host "If you see Internal Server Error, re-run: .\scripts\start-previews.ps1 -Clean"
Write-Host "API routes still need gateway (4000) + Postgres/Redis when testing live data."

if (-not $webOk -or -not $adminOk) {
  Write-Host ""
  Write-Host "--- web err (tail) ---"
  if (Test-Path $webErr) { Get-Content $webErr -Tail 40 }
  Write-Host "--- web out (tail) ---"
  if (Test-Path $webOut) { Get-Content $webOut -Tail 40 }
  Write-Host "--- admin err (tail) ---"
  if (Test-Path $adminErr) { Get-Content $adminErr -Tail 40 }
  Write-Host "--- admin out (tail) ---"
  if (Test-Path $adminOut) { Get-Content $adminOut -Tail 40 }
  exit 1
}
