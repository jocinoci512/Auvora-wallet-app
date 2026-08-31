# Health check for Auvora Local Solana QA.
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'local-solana-common.ps1')

if (-not (Test-QaSolanaHealthy)) {
  Write-Host 'LOCAL SOLANA  FAIL'
  exit 1
}

$slot = Invoke-QaSolanaRpc -Method 'getSlot'
$bh = Invoke-QaSolanaRpc -Method 'getLatestBlockhash' -Params @(@{ commitment = 'confirmed' })
Write-Host 'LOCAL SOLANA  HEALTHY'
Write-Host "NETWORK: $($script:AuvoraQaSolanaNetwork)"
Write-Host "RPC: $($script:AuvoraQaSolanaRpc)"
Write-Host "SLOT: $slot"
Write-Host "BLOCKHASH: $($bh.value.blockhash)"
Write-Host 'MAINNET: OFF'
exit 0
