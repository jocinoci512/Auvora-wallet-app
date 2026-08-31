# Stop Auvora Local EVM QA container. Preserves Docker volume state by default.

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-evm-common.ps1')

Push-Location $script:RepoRoot
try {
  docker compose -f $script:ComposeFile --profile qa-evm stop anvil
} finally {
  Pop-Location
}
Write-Host 'Auvora Local EVM QA stopped (state volume preserved).'
Write-Host 'Use reset-local-evm.ps1 for an intentional wipe + restart.'
