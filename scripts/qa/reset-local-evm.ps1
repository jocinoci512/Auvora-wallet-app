# INTENTIONAL reset of Auvora Local EVM QA state, then restart + optional fund.
# Not the default start path. LOCAL QA ONLY.

param(
  [switch]$Fund = $true,
  [string]$Address = $env:AUVORA_QA_EVM_ADDRESS,
  [string]$EthAmount = '1'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-evm-common.ps1')
if (-not $Address) { $Address = $script:AuvoraQaWallet }

Write-Host 'WARNING: Intentionally resetting Auvora Local EVM QA state volume.'
Push-Location $script:RepoRoot
try {
  docker compose -f $script:ComposeFile --profile qa-evm stop anvil 2>$null
  docker compose -f $script:ComposeFile --profile qa-evm rm -f anvil 2>$null
  docker volume rm auvora-wallet_auvora-anvil-data 2>$null
  # Compose project name may vary — try both common names.
  docker volume rm auvora-anvil-data 2>$null
  docker compose -f $script:ComposeFile --profile qa-evm up -d anvil
} finally {
  Pop-Location
}

$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  if (Test-QaEvmHealthy) { $ok = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ok) { throw 'Local EVM did not become healthy after reset.' }

if ($Fund) {
  $bal = Set-QaAnvilBalance -Address $Address -EthAmount $EthAmount
  Write-Host "FUNDED $Address => $(ConvertFrom-WeiHex $bal) QA ETH"
}

Write-Host 'RESET COMPLETE — Auvora Local EVM QA'
