# LOCAL QA - launch detached automated storage recovery from Cursor (saves backup, UAC, closes Cursor).
#Requires -Version 5.1
param(
  [string]$RepoRoot = 'D:\auvora-wallet'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'qa-recovery-common.ps1')

$alivePath = Join-Path $RepoRoot 'artifacts\recovery-bootstrap-alive.txt'
$pidPath = Join-Path $RepoRoot 'artifacts\recovery-bootstrap.pid'

Write-Host '==> Creating safety backup on D: ...'
$backupPath = & (Join-Path $PSScriptRoot 'save-pre-recovery-backup.ps1') -RepoRoot $RepoRoot
Write-Host "Safety backup: $backupPath"

Write-Host '==> Launching detached elevated recovery bootstrap ...'
Write-Host '    If Windows shows UAC: Click Yes on the Administrator popup.'
Write-Host ''

$bootstrap = Join-Path $PSScriptRoot 'auto-finish-storage-recovery.ps1'
$argList = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$bootstrap`"",
  '-Elevated', '-SafetyBackupPath', "`"$backupPath`"", '-RepoRoot', "`"$RepoRoot`""
)

# Detached elevated process (survives Cursor exit).
Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($argList -join ' ') -WindowStyle Normal

Write-Host 'Waiting for bootstrap to confirm it is alive ...'
$confirmed = $false
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  if (Test-Path -LiteralPath $alivePath) {
    $alive = Get-Content -LiteralPath $alivePath -Raw
    if ($alive -match 'BOOTSTRAP ALIVE') {
      $confirmed = $true
      break
    }
  }
  Start-Sleep -Seconds 2
}

if (-not $confirmed) {
  Write-Host ''
  Write-Host 'Bootstrap did not confirm within 90s.'
  Write-Host 'If UAC is waiting, click Yes. Recovery will continue after approval.'
  Write-Host 'Cursor will NOT be closed until bootstrap is confirmed.'
  Write-Host 'Re-run this script or approve UAC and wait for artifacts\recovery-bootstrap-alive.txt'
  exit 1
}

Write-Host "Bootstrap confirmed: $(Get-Content -LiteralPath $alivePath -Raw)"
if (Test-Path -LiteralPath $pidPath) {
  Write-Host "Bootstrap PID: $(Get-Content -LiteralPath $pidPath -Raw)"
}

Write-Host '==> Closing Cursor gracefully so recovery can move state/cache ...'
$closed = Invoke-GracefulCursorShutdown -GraceSec 25
if ($closed) {
  Write-Host 'Cursor closed. Detached recovery continues independently.'
} else {
  Write-Host 'Cursor may still be shutting down; bootstrap will wait and retry.'
}

Write-Host ''
Write-Host 'Recovery is running detached. When complete, Cursor will reopen automatically.'
Write-Host 'Report: D:\auvora-wallet\artifacts\qa-storage-recovery-report.txt'
Write-Host 'Live log: D:\auvora-wallet\artifacts\qa-storage-recovery-live.log'
