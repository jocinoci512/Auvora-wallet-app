# Start Auvora Local EVM QA (Anvil via Docker). Does NOT reset chain state.
# LOCAL QA ONLY — chainId 31337, never mainnet.

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-evm-common.ps1')

Write-Host 'Starting Auvora Local EVM QA (Anvil)...'
Push-Location $script:RepoRoot
try {
  docker compose -f $script:ComposeFile --profile qa-evm up -d anvil
} finally {
  Pop-Location
}

$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  if (Test-QaEvmHealthy) { $ok = $true; break }
  Start-Sleep -Seconds 2
}

if (-not $ok) {
  throw 'Auvora Local EVM QA failed to become healthy on http://127.0.0.1:8545'
}

$id = Invoke-QaJsonRpc -Method 'eth_chainId'
$block = Invoke-QaJsonRpc -Method 'eth_blockNumber'
Write-Host "NETWORK: Auvora Local EVM QA"
Write-Host "RPC: $($script:AuvoraQaEvmRpc) HEALTHY"
Write-Host "CHAIN ID: $($script:AuvoraQaEvmChainId) ($id)"
Write-Host "BLOCK: $block"
Write-Host "MAINNET: OFF"
