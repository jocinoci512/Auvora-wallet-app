# Fund the EXISTING Auvora QA public address on Auvora Local EVM QA.
# Uses anvil_setBalance — does NOT import or learn the user's private key.
# LOCAL QA ONLY. Balance has no monetary value.

param(
  [string]$Address = $env:AUVORA_QA_EVM_ADDRESS,
  [string]$EthAmount = '1'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-evm-common.ps1')
if (-not $Address) { $Address = $script:AuvoraQaWallet }

if (-not (Test-QaEvmHealthy)) {
  throw 'Auvora Local EVM QA is not healthy. Run start-local-evm.ps1 first.'
}

$before = ConvertFrom-WeiHex (Get-QaWeiBalance $Address)
$afterHex = Set-QaAnvilBalance -Address $Address -EthAmount $EthAmount
$after = ConvertFrom-WeiHex $afterHex

Write-Host "NETWORK: Auvora Local EVM QA"
Write-Host "CHAIN ID: $($script:AuvoraQaEvmChainId)"
Write-Host "ADDRESS: $Address"
Write-Host "BEFORE: $before QA ETH"
Write-Host "AFTER: $after QA ETH"
Write-Host "SERVER HAS USER PRIVATE KEY: NO"
Write-Host "MAINNET: OFF"
Write-Host "PUBLIC FAUCET: NOT USED"
