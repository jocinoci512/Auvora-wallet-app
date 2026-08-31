# LOCAL QA - detached bootstrap: survives Cursor exit, auto-elevates, runs full recovery, reopens Cursor.
#Requires -Version 5.1
param(
  [switch]$Elevated,
  [string]$SafetyBackupPath = '',
  [string]$RepoRoot = 'D:\auvora-wallet'
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'qa-recovery-common.ps1')

$logPath = Join-Path $RepoRoot 'artifacts\qa-storage-recovery-live.log'
$reportPath = Join-Path $RepoRoot 'artifacts\qa-storage-recovery-report.txt'
$summaryPath = Join-Path $RepoRoot 'artifacts\qa-storage-recovery-summary.md'
$alivePath = Join-Path $RepoRoot 'artifacts\recovery-bootstrap-alive.txt'
$pidPath = Join-Path $RepoRoot 'artifacts\recovery-bootstrap.pid'

function Write-Log([string]$msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Add-Content -Path $logPath -Value $line -Encoding UTF8
  Write-Host $line
}

if (-not (Test-IsAdmin)) {
  Write-Log 'Not elevated - relaunching with RunAs (UAC required).'
  $args = @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$(Join-Path $PSScriptRoot 'auto-finish-storage-recovery.ps1')`"",
    '-Elevated'
  )
  if ($SafetyBackupPath) { $args += @('-SafetyBackupPath', "`"$SafetyBackupPath`"") }
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($args -join ' ')
  exit 0
}

New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot 'artifacts') | Out-Null
"BOOTSTRAP ALIVE pid=$PID started=$(Get-Date -Format o)" | Set-Content -Path $alivePath -Encoding UTF8
$PID | Set-Content -Path $pidPath -Encoding UTF8
Start-Transcript -Path $logPath -Append -Force | Out-Null

Write-Log "Automated storage recovery bootstrap running (PID $PID, elevated)."

if (-not $SafetyBackupPath) {
  $latest = Get-ChildItem -Path 'D:\AuvoraArchive\safety\pre-storage-recovery' -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
  if ($latest) { $SafetyBackupPath = $latest.FullName }
}

$cursorExited = Wait-CursorProcessesExit -TimeoutSec 600 -Log { param($m) Write-Log $m }
if (-not $cursorExited) {
  Write-Log 'Cursor did not exit within timeout; attempting safe termination of remaining Cursor processes.'
  [void](Invoke-GracefulCursorShutdown -GraceSec 5)
  $cursorExited = Wait-CursorProcessesExit -TimeoutSec 120 -Log { param($m) Write-Log $m }
  if (-not $cursorExited) {
    Write-Log 'ERROR: Cursor processes still running; recovery may fail at state move.'
  }
}

Write-Log 'Starting finish-storage-recovery.ps1 (unattended) ...'
$orchArgs = @{
  Unattended         = $true
  SkipAdminElevation = $true
}
if ($SafetyBackupPath) { $orchArgs['SafetyBackupPath'] = $SafetyBackupPath }

try {
  & (Join-Path $PSScriptRoot 'finish-storage-recovery.ps1') @orchArgs
  $orchExit = $LASTEXITCODE
} catch {
  Write-Log "Orchestrator exception: $($_.Exception.Message)"
  $orchExit = 1
}

$reportExists = Test-Path -LiteralPath $reportPath
$ready = $false
if ($reportExists) {
  $reportText = Get-Content -LiteralPath $reportPath -Raw
  if ($reportText -match 'READY TO CONTINUE AUVORA QA:\s*YES') { $ready = $true }
}

$cursorReopened = $false
if ($reportExists) {
  $cursorExe = Resolve-CursorExe
  if ($cursorExe) {
    Write-Log "Reopening Cursor at $RepoRoot ..."
    Start-Process -FilePath $cursorExe -ArgumentList "`"$RepoRoot`" `"$reportPath`""
    $cursorReopened = $true
    Start-Sleep -Seconds 3
  } else {
    Write-Log 'Cursor executable not found; opening report in Notepad.'
    Start-Process notepad.exe -ArgumentList "`"$reportPath`""
  }

  if ($cursorReopened -and (Test-Path -LiteralPath $reportPath)) {
    $patched = (Get-Content -LiteralPath $reportPath -Raw) -replace 'CURSOR REOPENED:\s*NO', 'CURSOR REOPENED: YES'
    $patched | Set-Content -Path $reportPath -Encoding UTF8
  }

  $summary = @"
# Auvora automated storage recovery

Recovery finished at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss').

- **Report:** ``artifacts/qa-storage-recovery-report.txt``
- **Live log:** ``artifacts/qa-storage-recovery-live.log``
- **Safety backup:** ``$SafetyBackupPath``
- **Ready for QA:** $(if ($ready) { 'YES' } else { 'NO - review blockers in report' })

Open the report for full PASS/FAIL details.
"@
  $summary | Set-Content -Path $summaryPath -Encoding UTF8
}

Write-Log "Bootstrap complete (orchestrator exit=$orchExit, report=$reportExists, cursorReopened=$cursorReopened)."
Stop-Transcript | Out-Null
exit $orchExit
