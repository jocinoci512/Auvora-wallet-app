# Stop Auvora Local Solana QA container. Does not wipe ledger volume.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-solana-common.ps1')

Push-Location $script:RepoRoot
try {
  docker compose -f $script:ComposeFile --profile qa-solana stop solana-validator
} finally {
  Pop-Location
}
Write-Host 'Auvora Local Solana QA stopped (ledger volume preserved).'
