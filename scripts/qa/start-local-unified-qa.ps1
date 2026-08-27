# Isolated local Unified Account QA stack (NON-PRODUCTION)
#
# Prerequisites:
#   - Docker Desktop running (postgres + redis via docker-compose.yml)
#   - Node 22 + pnpm 9
#
# NEVER points at production DB. NEVER deploys Railway/Vercel.
#
# Usage:
#   powershell -File scripts/qa/start-local-unified-qa.ps1

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..\.."))

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

Require-Command docker
Require-Command pnpm

Write-Host "==> Starting local Postgres + Redis (docker compose)"
docker compose up -d postgres redis
docker compose ps

Write-Host "==> Waiting for health"
$deadline = (Get-Date).AddMinutes(2)
do {
  $pg = docker compose exec -T postgres pg_isready -U auvora -d auvora_wallet 2>$null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

Write-Host "==> Prisma generate + migrate deploy (LOCAL only)"
pnpm db:generate
pnpm --filter @auvora/database exec prisma migrate deploy

Write-Host "==> Seed (local)"
pnpm --filter @auvora/database seed

Write-Host @"

Next (separate terminals):

  `$env:PORT=4001; `$env:MAIL_DRIVER='notifications'; pnpm --filter @auvora/auth-service dev
  `$env:PORT=3006; pnpm --filter @auvora/notifications-service dev
  `$env:PORT=3002; pnpm --filter @auvora/wallet-service dev
  `$env:PORT=3005; `$env:COMPLIANCE_SIMULATOR_ENABLED='true'; pnpm --filter @auvora/compliance-service dev
  `$env:PORT=4000; pnpm --filter @auvora/gateway-service dev
  pnpm --filter @auvora/web dev
  pnpm --filter @auvora/admin dev

ADB reverse (physical device):
  adb reverse tcp:4000 tcp:4000
  adb reverse tcp:3000 tcp:3000

QA APK:
  powershell -File apps/mobile/android/scripts/build-qa.ps1
  adb install -r artifacts/auvora-qa-debug.apk

DO NOT uninstall com.auvora.auvora_wallet
DO NOT push to origin/main
DO NOT deploy production
"@
