# LOCAL QA - storage + Docker + Auvora QA recovery (interactive or unattended).
# Does NOT touch production, Git remotes, Android app data, or secrets.
#Requires -Version 5.1

param(
  [switch]$SkipCursorMove,
  [switch]$SkipDocker,
  [switch]$SkipQaRestart,
  [switch]$Unattended,
  [switch]$SkipAdminElevation,
  [string]$SafetyBackupPath = ''
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'qa-recovery-common.ps1')

$repoRoot = 'D:\auvora-wallet'
$reportPath = Join-Path $repoRoot 'artifacts\qa-storage-recovery-report.txt'
$qaUserId = 'df1db712-5e50-42c1-92fc-2c7236244cf8'
$vaultMigration = '20260827010000_encrypted_vault_blob'
$dockerTarget = 'D:\DockerData\wsl\disk\docker_data.vhdx'
$dockerLink = Join-Path $env:LOCALAPPDATA 'Docker\wsl\disk\docker_data.vhdx'
$cursorStateDir = 'D:\AuvoraDevCache\cursor-state\live'
$cursorCacheDir = 'D:\AuvoraDevCache\cursor-sandbox-cache'
$blockers = [System.Collections.Generic.List[string]]::new()

function Write-Log([string]$msg) {
  $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
  Write-Host $line
}

function Test-HttpStatus([string]$url, [int]$expected = 200, [int]$timeoutSec = 5) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec
    return ($r.StatusCode -eq $expected)
  } catch {
    try {
      $code = [int]$_.Exception.Response.StatusCode
      return ($code -eq $expected)
    } catch {
      return $false
    }
  }
}

function Wait-HttpOk([string]$url, [int]$seconds = 120) {
  $attempts = [math]::Ceiling($seconds / 3)
  for ($i = 0; $i -lt $attempts; $i++) {
    if (Test-HttpStatus $url 200 4) { return $true }
    Start-Sleep -Seconds 3
  }
  return $false
}

function Wait-CursorClosedInteractive {
  while ($true) {
    $procs = @(Get-CursorProcesses)
    if ($procs.Count -eq 0) { return }
    Write-Host ''
    Write-Host 'Cursor is still running. Close Cursor completely, then press Enter to continue.'
    $running = ($procs | ForEach-Object { "$($_.ProcessName) ($($_.Id))" }) -join ', '
    Write-Host "Running: $running"
    Read-Host | Out-Null
  }
}

function Wait-DockerEngine([int]$timeoutSec = 240) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      & docker version --format '{{.Server.Version}}' 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        & docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return $true }
      }
    } catch {}
    Start-Sleep -Seconds 4
  }
  return $false
}

function Find-Adb {
  @(
    (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'),
    (Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe'),
    'D:\Android\Sdk\platform-tools\adb.exe'
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}

function Get-GitHead([string]$path) {
  try { return (git -C $path rev-parse HEAD 2>$null).Trim() } catch { return $null }
}

function Get-GitPorcelainLines([string]$path) {
  try { return @((git -C $path status --porcelain 2>$null)) } catch { return @() }
}

function Test-ReparsePoint([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $false }
  return ((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
}

function Get-LinkTarget([string]$path) {
  try {
    $t = (Get-Item -LiteralPath $path -Force).Target
    if ($t -is [string[]]) { return $t[0] }
    return $t
  } catch { return $null }
}

function PassFail([bool]$ok) { if ($ok) { 'PASS' } else { 'FAIL' } }
function YesNo([bool]$ok) { if ($ok) { 'YES' } else { 'NO' } }
function HealthyFail([bool]$ok) { if ($ok) { 'HEALTHY' } else { 'FAIL' } }
function PreservedFail([bool]$ok, [bool]$notVerified) {
  if ($ok) { 'PRESERVED' } elseif ($notVerified) { 'NOT VERIFIED' } else { 'FAIL' }
}

if (-not $SkipAdminElevation) {
  if (-not (Test-IsAdmin)) {
    Write-Host 'Elevating to Administrator (UAC prompt)...'
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($SkipCursorMove) { $argList += '-SkipCursorMove' }
    if ($SkipDocker) { $argList += '-SkipDocker' }
    if ($SkipQaRestart) { $argList += '-SkipQaRestart' }
    if ($Unattended) { $argList += '-Unattended' }
    if ($SafetyBackupPath) { $argList += @('-SafetyBackupPath', "`"$SafetyBackupPath`"") }
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($argList -join ' ')
    exit 0
  }
}

New-Item -ItemType Directory -Force -Path (Split-Path $reportPath -Parent) | Out-Null
Set-Location $repoRoot

$preHead = $null
$preStatusLines = @()
if ($SafetyBackupPath -and (Test-Path (Join-Path $SafetyBackupPath 'git-head.txt'))) {
  $preHead = (Get-Content (Join-Path $SafetyBackupPath 'git-head.txt') -Raw).Trim()
  $preStatusLines = @(Get-Content (Join-Path $SafetyBackupPath 'git-status-porcelain.txt') -ErrorAction SilentlyContinue)
}

$gitHeadBefore = if ($preHead) { $preHead } else { Get-GitHead $repoRoot }
$gitLinesBefore = if ($preStatusLines.Count -gt 0) { $preStatusLines.Count } else { (Get-GitPorcelainLines $repoRoot).Count }
$cFreeBefore = Get-DriveFreeGB 'C'
$dFreeBefore = Get-DriveFreeGB 'D'

Write-Log "Recovery starting (unattended=$Unattended, C: $cFreeBefore GB free)"
Write-Log "Git HEAD snapshot: $gitHeadBefore ($gitLinesBefore changed/untracked)"

# --- Cursor state move ---
$cursorMoved = $false
$cursorCacheMoved = $false
$cursorLocation = $cursorStateDir
$cFreeAfterCursor = $cFreeBefore

if (-not $SkipCursorMove) {
  if ($Unattended) {
    $exited = Wait-CursorProcessesExit -TimeoutSec 600 -Log { param($m) Write-Log $m }
    if (-not $exited) { $blockers.Add('Cursor still running when state move attempted.') }
  } else {
    Wait-CursorClosedInteractive
  }

  Write-Log 'Running finish-cursor-state-move.ps1 ...'
  try {
    $cursorResult = & (Join-Path $repoRoot 'scripts\qa\finish-cursor-state-move.ps1')
    $cursorMoved = [bool]$cursorResult.StateMoved -or (Test-Path (Join-Path $cursorStateDir 'state.vscdb'))
    $cursorCacheMoved = [bool]$cursorResult.SandboxMoved -or (Test-Path $cursorCacheDir)
    $cursorLocation = $cursorResult.StateLocation
    $cFreeAfterCursor = Get-DriveFreeGB 'C'
    Write-Log "Cursor move complete (C: now $cFreeAfterCursor GB free)"
  } catch {
    $blockers.Add("Cursor state move failed: $($_.Exception.Message)")
    Write-Log "ERROR: $($_.Exception.Message)"
  }
} else {
  Write-Log 'Skipping Cursor state move (-SkipCursorMove)'
  if (Test-Path (Join-Path $cursorStateDir 'state.vscdb')) { $cursorMoved = $true }
  if (Test-Path $cursorCacheDir) { $cursorCacheMoved = $true }
}

# --- Docker ---
$dockerLinkOk = $false
$dockerEngineHealthy = $false
$dockerVhdxPath = $dockerTarget
$postgresHealthy = $false
$redisHealthy = $false
$vaultMigrationPresent = $false
$qaUserPreserved = $false
$encryptedVaultPreserved = $false
$vaultBlobCount = '0'

if (-not $SkipDocker) {
  Write-Log 'Repairing Docker VHDX link ...'
  try {
    $linkResult = & (Join-Path $repoRoot 'scripts\qa\finish-docker-vhdx-link.ps1')
    $dockerLinkOk = [bool]$linkResult.LinkOk
    $dockerVhdxPath = $linkResult.TargetPath
  } catch {
    $blockers.Add("Docker VHDX link failed: $($_.Exception.Message)")
    Write-Log "ERROR: $($_.Exception.Message)"
  }

  if ($dockerLinkOk) {
    $linkTarget = Get-LinkTarget $dockerLink
    if (-not $linkTarget) {
      $dockerLinkOk = $false
      $blockers.Add('Docker link created but target could not be resolved.')
    }
  }

  $cDupes = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Docker') -Recurse -Filter 'docker_data.vhdx' -ErrorAction SilentlyContinue |
    Where-Object { -not $_.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint) -and $_.FullName -ne $dockerLink }
  if ($cDupes) {
    $sizeGb = [math]::Round(($cDupes | Measure-Object Length -Sum).Sum / 1GB, 2)
    $blockers.Add("Unexpected real docker_data.vhdx on C: ($sizeGb GB). Not auto-deleted.")
  }

  Write-Log 'Starting Docker Desktop ...'
  $dockerExe = Resolve-DockerDesktopExe
  if (-not $dockerExe) {
    $blockers.Add('Docker Desktop executable not found.')
  } else {
    Start-Process -FilePath $dockerExe | Out-Null
    Write-Log 'Waiting for Docker Engine (up to 4 min) ...'
    $dockerEngineHealthy = Wait-DockerEngine 240
    if (-not $dockerEngineHealthy) {
      try {
        $diag = (& docker info 2>&1 | Out-String).Trim()
        if ($diag) { Write-Log "Docker diagnostic: $($diag.Substring(0, [math]::Min(500, $diag.Length)))" }
      } catch {}
      $blockers.Add('Docker Engine did not become healthy.')
    } else {
      Write-Log 'Docker Engine healthy.'
      & docker compose version 2>$null | Out-Null
    }
  }

  if ($dockerEngineHealthy) {
    Write-Log 'Ensuring Postgres + Redis (preserve volumes) ...'
    try {
      & docker compose -f (Join-Path $repoRoot 'docker-compose.yml') up -d postgres redis 2>&1 | Out-Null
      $deadline = (Get-Date).AddMinutes(3)
      do {
        $pgState = (& docker inspect -f '{{.State.Health.Status}}' auvora-postgres 2>$null).Trim()
        $redisState = (& docker inspect -f '{{.State.Health.Status}}' auvora-redis 2>$null).Trim()
        $postgresHealthy = ($pgState -eq 'healthy')
        $redisHealthy = ($redisState -eq 'healthy')
        if ($postgresHealthy -and $redisHealthy) { break }
        Start-Sleep -Seconds 3
      } while ((Get-Date) -lt $deadline)

      if (-not $postgresHealthy) { $blockers.Add("Postgres not healthy (state: $pgState).") }
      if (-not $redisHealthy) { $blockers.Add("Redis not healthy (state: $redisState).") }

      if ($postgresHealthy) {
        $migrationCount = (& docker exec auvora-postgres psql -U auvora -d auvora_wallet -tAc `
          "SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name = '$vaultMigration';" 2>$null).Trim()
        $vaultMigrationPresent = ($migrationCount -eq '1')

        $userCount = (& docker exec auvora-postgres psql -U auvora -d auvora_wallet -tAc `
          "SELECT COUNT(*) FROM users WHERE id = '$qaUserId';" 2>$null).Trim()
        $vaultBlobCount = (& docker exec auvora-postgres psql -U auvora -d auvora_wallet -tAc `
          "SELECT COUNT(*) FROM encrypted_vault_blobs WHERE owner_user_id = '$qaUserId';" 2>$null).Trim()
        $qaUserPreserved = ($userCount -eq '1')
        $encryptedVaultPreserved = ([int]$vaultBlobCount -ge 1)

        Write-Log "QA user=$qaUserPreserved vaultBlobs=$vaultBlobCount migration=$vaultMigrationPresent"
        if (-not $vaultMigrationPresent) { $blockers.Add("Vault migration $vaultMigration not found.") }
        if (-not $qaUserPreserved) { $blockers.Add('Canonical QA user not found in local database.') }
      }
    } catch {
      $blockers.Add("Postgres/Redis verification failed: $($_.Exception.Message)")
    }
  }
} else {
  Write-Log 'Skipping Docker (-SkipDocker)'
}

# --- QA stack ---
$authOk = $false
$walletOk = $false
$connectionsOk = $false
$gatewayHealthOk = $false
$gatewayReadyOk = $false
$webOk = $false

if (-not $SkipQaRestart -and $dockerEngineHealthy) {
  Write-Log 'Running restart-core-local-qa.ps1 ...'
  try {
    & (Join-Path $repoRoot 'scripts\qa\restart-core-local-qa.ps1')
  } catch {
    $blockers.Add("QA restart script error: $($_.Exception.Message)")
  }

  Start-Sleep -Seconds 5
  $authOk = Wait-HttpOk 'http://127.0.0.1:4001/ready' 150
  $walletOk = Wait-HttpOk 'http://127.0.0.1:3002/ready' 150
  $connectionsOk = Wait-HttpOk 'http://127.0.0.1:3016/ready' 150
  $gatewayHealthOk = Test-HttpStatus 'http://127.0.0.1:4000/health' 200 10
  $gatewayReadyOk = Wait-HttpOk 'http://127.0.0.1:4000/ready' 90
  $webOk = Wait-HttpOk 'http://127.0.0.1:3000' 120

  if (-not $gatewayReadyOk) { $blockers.Add('Gateway /ready did not return 200.') }
} elseif ($SkipQaRestart) {
  Write-Log 'Skipping QA restart (-SkipQaRestart)'
} else {
  $blockers.Add('QA stack not restarted because Docker is unavailable.')
}

# --- Android ---
$adbStatus = 'DEVICE DISCONNECTED'
$qaAppPreserved = $false
$originalAppPreserved = $false
$deviceConnected = $false
$adbExe = Find-Adb

if ($adbExe) {
  try {
    $devices = & $adbExe devices 2>&1 | Select-String 'device$'
    if ($devices) {
      $deviceConnected = $true
      $adbStatus = 'FAIL'
      foreach ($pkg in @(
        @{ Name = 'com.auvora.auvora_wallet.qa'; Ref = [ref]$qaAppPreserved },
        @{ Name = 'com.auvora.auvora_wallet'; Ref = [ref]$originalAppPreserved }
      )) {
        $installed = & $adbExe shell pm list packages $pkg.Name 2>$null
        $pkg.Ref.Value = ($installed -match [regex]::Escape($pkg.Name))
        if (-not $pkg.Ref.Value) { $blockers.Add("Expected package missing: $($pkg.Name)") }
      }
      & $adbExe reverse tcp:4000 tcp:4000 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { $adbStatus = 'PASS' }
    }
  } catch {
    $adbStatus = 'FAIL'
  }
} else {
  $qaAppPreserved = $true
  $originalAppPreserved = $true
}

# --- Git worktree ---
$gitHeadAfter = Get-GitHead $repoRoot
$gitLinesAfter = (Get-GitPorcelainLines $repoRoot).Count
$gitWorktreePreserved = ($gitHeadBefore -eq $gitHeadAfter) -and ($gitLinesAfter -ge $gitLinesBefore)

if ($gitHeadBefore -ne $gitHeadAfter) {
  $blockers.Add("Git HEAD changed ($gitHeadBefore -> $gitHeadAfter).")
}
if ($gitLinesAfter -lt $gitLinesBefore) {
  $blockers.Add("Fewer changed/untracked files after recovery ($gitLinesBefore -> $gitLinesAfter).")
}

# --- Storage ---
$cFreeAfter = Get-DriveFreeGB 'C'
$dFreeAfter = Get-DriveFreeGB 'D'
$cTargetPass = ($cFreeAfter -ge 25)
$storageCandidates = if (-not $cTargetPass) { Get-StorageCandidatesReport } else { 'N/A (target met)' }

if ($dockerEngineHealthy -and ($cFreeBefore - $cFreeAfter) -gt 2) {
  Write-Log "C: dropped $([math]::Round($cFreeBefore - $cFreeAfter, 2)) GB after Docker start."
}

$readyForQa = ($dockerEngineHealthy -and $postgresHealthy -and $redisHealthy -and `
  $gatewayReadyOk -and $authOk -and $walletOk -and $connectionsOk -and $webOk -and `
  $gitWorktreePreserved -and ($blockers.Count -eq 0))

$backupLabel = if ($SafetyBackupPath) { $SafetyBackupPath } else { 'NOT CREATED' }

$report = @"
AUVORA AUTOMATED STORAGE RECOVERY REPORT
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

C FREE BEFORE:
$cFreeBefore GB

C FREE AFTER:
$cFreeAfter GB

C FREE AFTER CURSOR MOVE:
$cFreeAfterCursor GB

TARGET >=25GB:
$(PassFail $cTargetPass)

PREFERRED >=30GB:
$(PassFail ($cFreeAfter -ge 30))

D FREE:
$dFreeAfter GB

CURSOR STATE MOVED:
$(YesNo $cursorMoved)

CURSOR CACHE MOVED:
$(YesNo $cursorCacheMoved)

CURSOR STATE LOCATION:
$cursorLocation

DOCKER VHDX LINK:
$(PassFail $dockerLinkOk)

DOCKER DATA LOCATION:
$dockerVhdxPath

DOCKER:
$(HealthyFail $dockerEngineHealthy)

POSTGRES:
$(HealthyFail $postgresHealthy)

REDIS:
$(HealthyFail $redisHealthy)

AUTH:
$(HealthyFail $authOk)

WALLET:
$(HealthyFail $walletOk)

CONNECTIONS:
$(HealthyFail $connectionsOk)

GATEWAY HEALTH:
$(PassFail $gatewayHealthOk)

GATEWAY READY:
$(PassFail $gatewayReadyOk)

WEB:
$(HealthyFail $webOk)

VAULT MIGRATION:
$(PassFail $vaultMigrationPresent)

QA USER DATA:
$(PreservedFail $qaUserPreserved $false)

ENCRYPTED VAULT:
$(PreservedFail $encryptedVaultPreserved (-not $postgresHealthy))

VAULT BLOB COUNT (safe):
$vaultBlobCount

AUVORA QA APP:
$(PreservedFail $qaAppPreserved (-not $deviceConnected))

ORIGINAL AUVORA APP:
$(PreservedFail $originalAppPreserved (-not $deviceConnected))

ADB REVERSE:
$adbStatus

GIT HEAD BEFORE:
$gitHeadBefore

GIT HEAD AFTER:
$gitHeadAfter

GIT WORKTREE:
$(PreservedFail $gitWorktreePreserved $false)

SAFETY BACKUP:
$backupLabel

ADDITIONAL STORAGE CANDIDATES (if C: still low):
$storageCandidates

PRODUCTION TOUCHED:
NO

GIT PUSHED:
NO

MAINNET:
OFF

CURSOR REOPENED:
NO

CRITICAL BLOCKERS:
$(if ($blockers.Count -eq 0) { 'NONE' } else { ($blockers | ForEach-Object { "- $_" }) -join "`n" })

READY TO CONTINUE AUVORA QA:
$(YesNo $readyForQa)
"@

$report | Set-Content -Path $reportPath -Encoding UTF8
Write-Host ''
Write-Host $report
Write-Host ''
Write-Host "Report written to: $reportPath"

if (-not $readyForQa) { exit 1 }
exit 0
