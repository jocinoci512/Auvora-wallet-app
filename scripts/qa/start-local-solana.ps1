# Start Auvora Local Solana QA (solana-test-validator via Docker).
# LOCAL QA ONLY — never mainnet / never public Devnet faucet dependence.

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-solana-common.ps1')

Write-Host 'Starting Auvora Local Solana QA...'
Push-Location $script:RepoRoot
try {
  docker compose -f $script:ComposeFile --profile qa-solana up -d solana-validator
} finally {
  Pop-Location
}

$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  if (Test-QaSolanaHealthy) {
    try {
      $slot = [int](Invoke-QaSolanaRpc -Method 'getSlot')
      if ($slot -gt 0) { $ok = $true; break }
    } catch {}
  }
  Start-Sleep -Seconds 3
}

if (-not $ok) {
  throw "Auvora Local Solana QA failed to become healthy on $($script:AuvoraQaSolanaRpc)"
}

$version = Invoke-QaSolanaRpc -Method 'getVersion'
$slot = Invoke-QaSolanaRpc -Method 'getSlot'
Write-Host "NETWORK: $($script:AuvoraQaSolanaNetwork)"
Write-Host "RPC: $($script:AuvoraQaSolanaRpc) HEALTHY"
Write-Host "VERSION: $($version['solana-core'])"
Write-Host "SLOT: $slot"
Write-Host 'MAINNET: OFF'
