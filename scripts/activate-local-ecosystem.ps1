<#
.SYNOPSIS
  Local ecosystem readiness board for Auvora Wallet E2E activation.

.DESCRIPTION
  Checks Postgres (5432), Redis (6379), Prisma migrate status, and required env KEY
  presence (PRESENT / MISSING / PLACEHOLDER) without printing secret VALUES.
  Optionally starts the embedded data plane (no Docker required).

.EXAMPLE
  pwsh -File scripts/activate-local-ecosystem.ps1
  pwsh -File scripts/activate-local-ecosystem.ps1 -StartDataPlane
  pwsh -File scripts/activate-local-ecosystem.ps1 -MigrateDeploy
#>
[CmdletBinding()]
param(
  [switch]$StartDataPlane,
  [switch]$MigrateDeploy,
  [string]$Root = ''
)

$ErrorActionPreference = 'Continue'
if ([string]::IsNullOrWhiteSpace($Root)) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $Root = (Resolve-Path (Join-Path $scriptDir '..')).Path
}
Set-Location $Root

function Write-Board([string]$name, [string]$status, [string]$note = '') {
  $color = switch ($status) {
    'GREEN' { 'Green' }
    'YELLOW' { 'Yellow' }
    'RED' { 'Red' }
    default { 'Gray' }
  }
  $pad = $name.PadRight(36)
  Write-Host ("[{0}] {1}" -f $status.PadRight(6), $pad) -ForegroundColor $color -NoNewline
  if ($note) { Write-Host "  $note" -ForegroundColor DarkGray } else { Write-Host '' }
}

function Test-TcpPort([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(800)
    if ($ok -and $client.Connected) { $client.Close(); return $true }
    $client.Close()
    return $false
  } catch {
    return $false
  }
}

function Get-EnvMap {
  $map = @{}
  $envFile = Join-Path $Root '.env'
  if (-not (Test-Path $envFile)) { return $map }
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
    $map[$key] = $value
  }
  return $map
}

function Get-KeyStatus([hashtable]$map, [string]$key) {
  if (-not $map.ContainsKey($key)) { return 'MISSING' }
  $v = $map[$key]
  if ([string]::IsNullOrWhiteSpace($v)) { return 'EMPTY' }
  if ($v -match 'change.?me|placeholder|<generate|openssl-rand|example\.com|REPLACE|TODO|your[_-]project') {
    return 'PLACEHOLDER'
  }
  return 'PRESENT'
}

Write-Host ''
Write-Host 'AUVORA LOCAL ECOSYSTEM READINESS' -ForegroundColor Cyan
Write-Host ("Root: {0}" -f $Root) -ForegroundColor DarkGray
Write-Host ''

# --- Data plane ---
$pgUp = Test-TcpPort 5432
$redisUp = Test-TcpPort 6379
Write-Board 'Postgres :5432' $(if ($pgUp) { 'GREEN' } else { 'RED' }) $(if ($pgUp) { 'listening' } else { 'down — start Docker compose or -StartDataPlane' })
Write-Board 'Redis :6379' $(if ($redisUp) { 'GREEN' } else { 'RED' }) $(if ($redisUp) { 'listening' } else { 'down — start Docker compose or -StartDataPlane' })

$dockerOk = [bool](Get-Command docker -ErrorAction SilentlyContinue)
Write-Board 'Docker CLI' $(if ($dockerOk) { 'GREEN' } else { 'YELLOW' }) $(if ($dockerOk) { 'available' } else { 'not on PATH — use embedded data plane' })

if ($StartDataPlane -and (-not $pgUp -or -not $redisUp)) {
  Write-Host ''
  Write-Host 'Starting embedded Postgres + Redis (scripts/start-local-data.mjs)…' -ForegroundColor Cyan
  $logDir = Join-Path $Root '.local-data'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $outLog = Join-Path $logDir 'data-plane.out.log'
  $errLog = Join-Path $logDir 'data-plane.err.log'
  Start-Process -FilePath 'node' -ArgumentList 'scripts/start-local-data.mjs' `
    -WorkingDirectory $Root -WindowStyle Hidden `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog | Out-Null
  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Seconds 2
    $pgUp = Test-TcpPort 5432
    $redisUp = Test-TcpPort 6379
  } while ((-not $pgUp -or -not $redisUp) -and (Get-Date) -lt $deadline)
  Write-Board 'Postgres :5432 (after start)' $(if ($pgUp) { 'GREEN' } else { 'RED' })
  Write-Board 'Redis :6379 (after start)' $(if ($redisUp) { 'GREEN' } else { 'RED' })
}

# --- Env keys (status only) ---
Write-Host ''
Write-Host 'ENV KEY BOARD (values never printed)' -ForegroundColor Cyan
$map = Get-EnvMap
if ($map.Count -eq 0) {
  Write-Board '.env file' 'RED' 'missing — copy from .env.example'
} else {
  Write-Board '.env file' 'GREEN' 'present (gitignored)'
}

$required = @(
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CSRF_SECRET',
  'INTERNAL_API_KEY',
  'APP_PUBLIC_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_APP_URL',
  'CORS_ORIGINS',
  'WC_PROJECT_ID',
  'NEXT_PUBLIC_WC_PROJECT_ID',
  'ALCHEMY_API_KEY',
  'MAIL_DRIVER'
)

$secretKeys = @('JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CSRF_SECRET', 'INTERNAL_API_KEY')
$blocking = 0
foreach ($k in $required) {
  $st = Get-KeyStatus $map $k
  $board = switch ($st) {
    'PRESENT' { 'GREEN' }
    'PLACEHOLDER' { if ($secretKeys -contains $k) { 'RED' } else { 'YELLOW' } }
    'EMPTY' { 'RED' }
    'MISSING' { 'RED' }
  }
  if ($board -eq 'RED') { $blocking++ }
  Write-Board $k $board $st
}

# Guidance checks (no values)
$appUrl = if ($map.ContainsKey('APP_PUBLIC_URL')) { $map['APP_PUBLIC_URL'] } else { '' }
if ($appUrl -match ':4000') {
  Write-Board 'APP_PUBLIC_URL target' 'RED' 'points at gateway :4000 — must be web origin :3000'
  $blocking++
} elseif ($appUrl -match ':3000' -or $appUrl -match '^https://') {
  Write-Board 'APP_PUBLIC_URL target' 'GREEN' 'web-origin shaped'
} else {
  Write-Board 'APP_PUBLIC_URL target' 'YELLOW' 'unexpected shape'
}

$cookieDomain = if ($map.ContainsKey('COOKIE_DOMAIN')) { $map['COOKIE_DOMAIN'] } else { '' }
if ($cookieDomain -eq 'localhost') {
  Write-Board 'COOKIE_DOMAIN' 'YELLOW' 'localhost domain often breaks host-only cookies — prefer empty locally'
} else {
  Write-Board 'COOKIE_DOMAIN' 'GREEN' $(if ([string]::IsNullOrWhiteSpace($cookieDomain)) { 'empty (host-only OK)' } else { 'set' })
}

# --- Migrations ---
Write-Host ''
Write-Host 'MIGRATIONS' -ForegroundColor Cyan
$migrateOk = $false
if ($pgUp) {
  if ($MigrateDeploy) {
    Write-Host 'Running prisma migrate deploy…' -ForegroundColor Cyan
    & pnpm --filter @auvora/database-schema migrate:deploy
    if ($LASTEXITCODE -ne 0) {
      Write-Board 'migrate:deploy' 'RED' "exit $LASTEXITCODE"
    } else {
      Write-Board 'migrate:deploy' 'GREEN' 'applied'
      $migrateOk = $true
    }
  }
  Push-Location (Join-Path $Root 'database')
  try {
    $statusOut = & pnpm exec prisma migrate status 2>&1 | Out-String
    if ($statusOut -match 'Database schema is up to date') {
      Write-Board 'prisma migrate status' 'GREEN' 'up to date'
      $migrateOk = $true
    } elseif ($statusOut -match 'Following migrations have not yet been applied|not yet been applied') {
      Write-Board 'prisma migrate status' 'RED' 'pending — run with -MigrateDeploy'
    } else {
      Write-Board 'prisma migrate status' 'YELLOW' 'see prisma output'
      Write-Host $statusOut -ForegroundColor DarkGray
    }
  } catch {
    Write-Board 'prisma migrate status' 'RED' $_.Exception.Message
  } finally {
    Pop-Location
  }
} else {
  Write-Board 'prisma migrate status' 'RED' 'skipped — Postgres down'
}

# --- Service smoke (optional if ports up) ---
Write-Host ''
Write-Host 'SERVICE PORTS (smoke listen)' -ForegroundColor Cyan
foreach ($pair in @(
  @{ n = 'Gateway :4000'; p = 4000 },
  @{ n = 'Auth :4001'; p = 4001 },
  @{ n = 'Web :3000'; p = 3000 },
  @{ n = 'Connections :3016'; p = 3016 },
  @{ n = 'Blockchain :3003'; p = 3003 }
)) {
  $up = Test-TcpPort $pair.p
  Write-Board $pair.n $(if ($up) { 'GREEN' } else { 'YELLOW' }) $(if ($up) { 'up' } else { 'not listening' })
}

# --- Mailpit optional ---
$mailpit = Test-TcpPort 8025
Write-Board 'Mailpit UI :8025' $(if ($mailpit) { 'GREEN' } else { 'YELLOW' }) $(if ($mailpit) { 'local inbox' } else { 'optional — docker compose --profile mail up -d' })

# --- Summary ---
Write-Host ''
$dataReady = $pgUp -and $redisUp
$envReady = $blocking -eq 0
Write-Host 'SUMMARY' -ForegroundColor Cyan
Write-Board 'Data plane' $(if ($dataReady) { 'GREEN' } else { 'RED' })
Write-Board 'Critical env' $(if ($envReady) { 'GREEN' } else { 'RED' }) "$blocking blocking key(s)"
Write-Board 'Migrations' $(if ($migrateOk) { 'GREEN' } else { 'YELLOW' })
Write-Host ''
Write-Host 'Next:' -ForegroundColor Cyan
if (-not $dataReady) {
  Write-Host '  1) Install Docker Desktop OR: powershell -File scripts/activate-local-ecosystem.ps1 -StartDataPlane' -ForegroundColor White
}
if (-not $envReady) {
  Write-Host '  2) Fix RED env keys (secrets: openssl rand -base64 64). Never commit .env.' -ForegroundColor White
}
if ($dataReady -and -not $migrateOk) {
  Write-Host '  3) powershell -File scripts/activate-local-ecosystem.ps1 -MigrateDeploy' -ForegroundColor White
}
if ($dataReady -and $envReady) {
  Write-Host '  Load env then start services (auth must use AUTH_PORT=4001 — root PORT is gateway):' -ForegroundColor White
  Write-Host '    . .\scripts\load-env.ps1; $env:PORT=$env:AUTH_PORT' -ForegroundColor DarkGray
  Write-Host '    cmd /c "pnpm --filter @auvora/auth-service dev"' -ForegroundColor DarkGray
  Write-Host '    cmd /c "pnpm --filter @auvora/gateway-service dev"' -ForegroundColor DarkGray
  Write-Host '  Web: pnpm --filter @auvora/web dev' -ForegroundColor White
  Write-Host '  Mailpit (optional): docker compose --profile mail up -d' -ForegroundColor White
}
Write-Host ''

if (-not $dataReady -or -not $envReady) { exit 2 }
if (-not $migrateOk) { exit 1 }
exit 0
