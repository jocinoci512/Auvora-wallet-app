# Shared helpers for Auvora Local Solana QA. LOCAL QA ONLY — never mainnet.

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:ComposeFile = Join-Path $script:RepoRoot 'docker-compose.yml'
$script:AuvoraQaSolanaRpc = if ($env:AUVORA_QA_SOLANA_RPC) { $env:AUVORA_QA_SOLANA_RPC } else { 'http://127.0.0.1:8899' }
$script:AuvoraQaSolanaNetwork = 'Auvora Local Solana QA'
# Existing registered Auvora QA Solana public address (self-custody). Never a private key.
$script:AuvoraQaSolanaAddress = if ($env:AUVORA_QA_SOLANA_ADDRESS) {
  $env:AUVORA_QA_SOLANA_ADDRESS
} else {
  '8jFiN4JabxmBwkCVVFnaNyszExbCdd7k2TDuFQHyNThQ'
}
# Deterministic LOCAL QA recipient (public only) — abandon…about @ m/44'/501'/0'/0'
# Must match AuvoraQaLocalSolana.controlledRecipient / solana_sign_transfer_test.
$script:AuvoraQaSolanaRecipient = if ($env:AUVORA_QA_SOLANA_RECIPIENT) {
  $env:AUVORA_QA_SOLANA_RECIPIENT
} else {
  'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'
}

function Invoke-QaSolanaRpc {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [object[]]$Params = @()
  )
  $body = @{ jsonrpc = '2.0'; id = 1; method = $Method; params = $Params } | ConvertTo-Json -Compress -Depth 8
  $resp = Invoke-RestMethod -Uri $script:AuvoraQaSolanaRpc -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 20
  if ($null -ne $resp.error) {
    throw "Solana RPC $Method failed: $($resp.error | ConvertTo-Json -Compress)"
  }
  return $resp.result
}

function Test-QaSolanaHealthy {
  try {
    $health = Invoke-WebRequest -Uri "$($script:AuvoraQaSolanaRpc)/health" -UseBasicParsing -TimeoutSec 5
    if ($health.StatusCode -ne 200) { return $false }
    $null = Invoke-QaSolanaRpc -Method 'getVersion'
    return $true
  } catch {
    return $false
  }
}
