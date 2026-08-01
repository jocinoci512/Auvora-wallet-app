#Requires -Version 5.1
<#
.SYNOPSIS
  Bounded Alchemy Agent Wallet (session) reconnect — never replaces local wallets.

.DESCRIPTION
  Root cause of prior hangs: `alchemy wallet connect --mode session` waits
  indefinitely for Dashboard approval and emits little/no stdout when run
  without an interactive TTY.

  This script:
  - Refuses to run `wallet connect --mode local` (preserves existing keys)
  - Starts/reuses a session request
  - Polls `wallet status` until approved, rejected, or TIMEOUT
  - Exits non-zero on timeout so CI/agents never hang forever

.PARAMETER TimeoutSeconds
  Max wait for dashboard approval (default 120).

.PARAMETER InstanceName
  CLI instance label shown in the Alchemy dashboard.
#>
param(
  [int]$TimeoutSeconds = 120,
  [string]$InstanceName = 'auvora-dev',
  [switch]$ForceNewRequest
)

$ErrorActionPreference = 'Stop'

function Invoke-AlchemyJson([string[]]$AlchemyArgs) {
  $raw = & alchemy --json --no-interactive @AlchemyArgs 2>$null
  if (-not $raw) { return $null }
  try { return ($raw | ConvertFrom-Json) } catch { return $null }
}

Write-Host '=== Alchemy session reconnect (bounded) ==='
$auth = Invoke-AlchemyJson @('auth', 'status')
if (-not $auth -or -not $auth.authenticated) {
  Write-Host 'ERROR: Not authenticated. Run: alchemy auth login --device-code -y'
  exit 2
}

$before = Invoke-AlchemyJson @('wallet', 'address')
if ($before) {
  Write-Host ("Preserving local EVM: {0}" -f $before.evm)
  Write-Host ("Preserving local Solana: {0}" -f $before.solana)
}

$status = Invoke-AlchemyJson @('wallet', 'status')
if ($status -and $status.session -and $status.session.valid) {
  Write-Host 'Session already valid — nothing to do.'
  exit 0
}

Write-Host 'Open Alchemy Agent Wallets dashboard and approve the pending CLI session:'
Write-Host '  https://dashboard.alchemy.com/wallets'
Write-Host ("Instance: {0} | timeout: {1}s" -f $InstanceName, $TimeoutSeconds)
Write-Host 'Local keys will NOT be regenerated.'

$connectArgs = @('wallet', 'connect', '--mode', 'session', '--instance-name', $InstanceName)
if ($ForceNewRequest) { $connectArgs += '--force' }

# Start connect in background — it may block until approval.
$proc = Start-Process -FilePath 'alchemy' -ArgumentList ($connectArgs -join ' ') `
  -PassThru -WindowStyle Hidden -RedirectStandardOutput "$env:TEMP\alchemy-session-out.txt" `
  -RedirectStandardError "$env:TEMP\alchemy-session-err.txt"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$approved = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 3
  $poll = Invoke-AlchemyJson @('wallet', 'status', '--verify')
  if ($poll -and $poll.valid -eq $true) {
    $approved = $true
    break
  }
  if ($poll -and $poll.remoteStatus -eq 'rejected') {
    Write-Host 'FAIL: Dashboard rejected the session request.'
    if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
    exit 3
  }
  Write-Host -NoNewline '.'
}

Write-Host ''
if (-not $proc.HasExited) {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

$after = Invoke-AlchemyJson @('wallet', 'address')
if ($before -and $after -and $before.evm -and $after.evm -and ($before.evm -ne $after.evm)) {
  Write-Host 'WARNING: Local EVM address changed unexpectedly — investigate before funding.'
}

if (-not $approved) {
  Write-Host 'TIMEOUT: Session approval did not complete.'
  Write-Host 'Local wallet remains active. Auvora app does not require session Agent Wallet'
  Write-Host 'to open the dashboard — use local signer + public/Alchemy RPC probes.'
  exit 4
}

Write-Host 'SUCCESS: Session wallet approved.'
if ($after) {
  Write-Host ("Local EVM (unchanged source): {0}" -f $after.evm)
  Write-Host ("Session EVM: {0}" -f $after.session.evm)
}
exit 0
