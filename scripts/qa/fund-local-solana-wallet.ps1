# Fund the EXISTING Auvora Solana QA public address on the local validator.
# Uses requestAirdrop only — never imports the Auvora private key.
# LOCAL QA ONLY.

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-solana-common.ps1')

if (-not (Test-QaSolanaHealthy)) {
  throw 'Local Solana validator is not healthy. Run start-local-solana.ps1 first.'
}

$address = $script:AuvoraQaSolanaAddress
$lamports = if ($env:AUVORA_QA_SOLANA_AIRDROP_LAMPORTS) {
  [long]$env:AUVORA_QA_SOLANA_AIRDROP_LAMPORTS
} else {
  5000000000 # 5 QA SOL
}

function Get-QaSolanaBalanceLamports([string]$addr) {
  $bal = Invoke-QaSolanaRpc -Method 'getBalance' -Params @($addr, @{ commitment = 'confirmed' })
  return [long]$bal.value
}

$before = Get-QaSolanaBalanceLamports $address
Write-Host "Funding existing Auvora Solana address (public only)..."
Write-Host "ADDRESS: $address"
Write-Host "AMOUNT: $($lamports / 1e9) QA SOL"
Write-Host "BALANCE_BEFORE: $($before / 1e9) QA SOL"

$sig = Invoke-QaSolanaRpc -Method 'requestAirdrop' -Params @($address, $lamports)
Write-Host "AIRDROP_SIG: $sig"

$confirmed = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  try {
    $st = Invoke-QaSolanaRpc -Method 'getSignatureStatuses' -Params @(
      @(, $sig),
      @{ searchTransactionHistory = $true }
    )
    $value = $st.value[0]
    if ($null -eq $value) { continue }
    if ($null -ne $value.err) { throw "Airdrop failed on-chain: $($value.err | ConvertTo-Json -Compress)" }
    if ($value.confirmationStatus -eq 'confirmed' -or $value.confirmationStatus -eq 'finalized') {
      $confirmed = $true
      break
    }
  } catch {
    if ("$_" -match 'Airdrop failed') { throw }
  }
}
if (-not $confirmed) {
  throw "Airdrop signature $sig did not confirm."
}

$after = 0L
for ($i = 0; $i -lt 30; $i++) {
  $after = Get-QaSolanaBalanceLamports $address
  if ($after -gt $before) { break }
  Start-Sleep -Seconds 1
}
if ($after -le $before) {
  throw "Airdrop confirmed but balance did not increase (before=$before after=$after)."
}

$sol = [double]$after / 1e9
Write-Host "BALANCE: $sol QA SOL"

# Ensure controlled LOCAL QA recipient is rent-funded (public only, never user key).
$recipient = $script:AuvoraQaSolanaRecipient
try {
  $recvBefore = Get-QaSolanaBalanceLamports $recipient
  if ($recvBefore -lt 1000000000) {
    $recvSig = Invoke-QaSolanaRpc -Method 'requestAirdrop' -Params @($recipient, 2000000000)
    Write-Host "RECIPIENT_AIRDROP_SIG: $recvSig"
    Start-Sleep -Seconds 2
  }
  $recvAfter = Get-QaSolanaBalanceLamports $recipient
  Write-Host "RECIPIENT: $recipient"
  Write-Host "RECIPIENT_BALANCE: $($recvAfter / 1e9) QA SOL"
} catch {
  Write-Host "RECIPIENT_FUND_WARN: $_"
}

Write-Host 'VALIDATOR_IMPORTED_USER_KEY: NO'
Write-Host 'MAINNET: OFF'
