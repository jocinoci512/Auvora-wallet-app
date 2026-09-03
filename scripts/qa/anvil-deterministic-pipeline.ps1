# Deterministic Anvil account #0 pipeline — NEVER uses Auvora user keys.
# Signs + broadcasts 0.0001 ETH to Anvil account #1 on chain 31337.
$ErrorActionPreference = 'Stop'
$rpc = 'http://127.0.0.1:8545'
$user = '0x1d549b12f406ec094cdc4e796cf64394e06a32b5'
$pk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
$to = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

function Rpc([string]$method, $params) {
  $body = @{ jsonrpc = '2.0'; id = 1; method = $method; params = $params } | ConvertTo-Json -Compress -Depth 8
  return (Invoke-RestMethod -Uri $rpc -Method Post -Body $body -ContentType 'application/json')
}

$chain = [Convert]::ToInt64((Rpc 'eth_chainId' @()).result, 16)
if ($chain -ne 31337) { throw "Unexpected chain $chain" }

$userNonceBefore = [Convert]::ToInt64((Rpc 'eth_getTransactionCount' @($user, 'latest')).result, 16)
$userBalBefore = (Rpc 'eth_getBalance' @($user, 'latest')).result

$out = docker exec auvora-anvil cast send $to --value 0.0001ether --private-key $pk --rpc-url http://127.0.0.1:8545 --legacy --json 2>&1
Write-Host $out
$userNonceAfter = [Convert]::ToInt64((Rpc 'eth_getTransactionCount' @($user, 'latest')).result, 16)
$userBalAfter = (Rpc 'eth_getBalance' @($user, 'latest')).result

if ($userNonceAfter -ne $userNonceBefore) { throw 'User nonce changed — abort' }
if ($userBalAfter -ne $userBalBefore) { throw 'User balance changed — abort' }
if ($userBalAfter -ne '0xde0b6b3a7640000') { throw "User balance unexpected: $userBalAfter" }

Write-Host 'DETERMINISTIC_ANVIL_PIPELINE=PASS'
Write-Host "USER_NONCE_UNCHANGED=$userNonceAfter"
Write-Host "USER_BALANCE_UNCHANGED=$userBalAfter"
