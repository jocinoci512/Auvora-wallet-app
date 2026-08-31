# Auvora Local EVM QA helpers (shared by start/stop/reset/fund/check).
# LOCAL QA ONLY — never points at mainnet or public production RPCs.

$ErrorActionPreference = 'Stop'

$script:AuvoraQaEvmRpc = if ($env:AUVORA_QA_EVM_RPC) { $env:AUVORA_QA_EVM_RPC } else { 'http://127.0.0.1:8545' }
$script:AuvoraQaEvmChainId = if ($env:AUVORA_QA_EVM_CHAIN_ID) { [int]$env:AUVORA_QA_EVM_CHAIN_ID } else { 31337 }
$script:AuvoraQaWallet = if ($env:AUVORA_QA_EVM_ADDRESS) {
  $env:AUVORA_QA_EVM_ADDRESS
} else {
  '0x1d549b12f406ec094cdc4e796cf64394e06a32b5'
}
# Deterministic Anvil account #1 — LOCAL QA recipient only (node knows this key; Auvora vault does not).
$script:AuvoraQaRecipient = if ($env:AUVORA_QA_EVM_RECIPIENT) {
  $env:AUVORA_QA_EVM_RECIPIENT
} else {
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
}
$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:ComposeFile = Join-Path $RepoRoot 'docker-compose.yml'
$script:AnvilContainer = 'auvora-anvil'

function Invoke-QaJsonRpc {
  param(
    [string]$Method,
    [object[]]$Params = @(),
    [string]$RpcUrl = $script:AuvoraQaEvmRpc
  )
  $body = @{
    jsonrpc = '2.0'
    id      = 1
    method  = $Method
    params  = $Params
  } | ConvertTo-Json -Compress -Depth 6
  $res = Invoke-RestMethod -Method Post -Uri $RpcUrl -ContentType 'application/json' -Body $body -TimeoutSec 8
  if ($null -ne $res.error) {
    throw "JSON-RPC $Method failed: $($res.error | ConvertTo-Json -Compress)"
  }
  return $res.result
}

function Test-QaEvmHealthy {
  try {
    $idHex = Invoke-QaJsonRpc -Method 'eth_chainId'
    $id = [Convert]::ToInt64(($idHex -replace '^0x', ''), 16)
    if ($id -ne $script:AuvoraQaEvmChainId) {
      Write-Host "LOCAL EVM chainId mismatch: got $id expected $($script:AuvoraQaEvmChainId)"
      return $false
    }
    $null = Invoke-QaJsonRpc -Method 'eth_blockNumber'
    return $true
  } catch {
    return $false
  }
}

function Get-QaWeiBalance([string]$Address) {
  return Invoke-QaJsonRpc -Method 'eth_getBalance' -Params @($Address, 'latest')
}

function ConvertFrom-WeiHex([string]$Hex) {
  $h = ($Hex -replace '^0x', '').TrimStart('0')
  if ([string]::IsNullOrWhiteSpace($h)) { return [decimal]0 }
  # Prefix '0' so Parse never treats the high bit as a sign bit.
  $wei = [System.Numerics.BigInteger]::Parse('0' + $h, [System.Globalization.NumberStyles]::AllowHexSpecifier)
  return [decimal]$wei / [decimal]1000000000000000000
}

function Set-QaAnvilBalance {
  param(
    [string]$Address = $script:AuvoraQaWallet,
    [string]$EthAmount = '1'
  )
  # Default exact 1 ETH. Avoid signed/float wei conversion bugs.
  $hex = switch ([string]$EthAmount) {
    '1' { '0xde0b6b3a7640000' }
    '10' { '0x8ac7230489e80000' }
    '0.1' { '0x16345785d8a0000' }
    default {
      $wei = [System.Numerics.BigInteger]::Parse('1000000000000000000')
      $scaled = [System.Numerics.BigInteger]([int64]([math]::Round([double]$EthAmount * 1000)))
      $wei = ($wei * $scaled) / [System.Numerics.BigInteger]1000
      '0x' + $wei.ToString('x').TrimStart('0')
    }
  }
  if ($hex -eq '0x') { $hex = '0x0' }
  $null = Invoke-QaJsonRpc -Method 'anvil_setBalance' -Params @($Address, $hex)
  return Get-QaWeiBalance $Address
}
