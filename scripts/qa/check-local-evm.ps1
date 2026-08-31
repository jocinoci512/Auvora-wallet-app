# Health check for Auvora Local EVM QA.

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'local-evm-common.ps1')

$healthy = Test-QaEvmHealthy
if (-not $healthy) {
  Write-Host 'LOCAL EVM      FAIL'
  exit 1
}

$id = Invoke-QaJsonRpc -Method 'eth_chainId'
$block = Invoke-QaJsonRpc -Method 'eth_blockNumber'
$balHex = Get-QaWeiBalance $script:AuvoraQaWallet
$bal = ConvertFrom-WeiHex $balHex

Write-Host 'LOCAL EVM      HEALTHY'
Write-Host "NETWORK:       Auvora Local EVM QA"
Write-Host "RPC:           $($script:AuvoraQaEvmRpc)"
Write-Host "CHAIN ID:      $($script:AuvoraQaEvmChainId) ($id)"
Write-Host "BLOCK:         $block"
Write-Host "QA WALLET:     $($script:AuvoraQaWallet)"
Write-Host "QA BALANCE:    $bal QA ETH"
Write-Host "QA RECIPIENT:  $($script:AuvoraQaRecipient) (LOCAL QA ONLY)"
Write-Host 'MAINNET:       OFF'
exit 0
