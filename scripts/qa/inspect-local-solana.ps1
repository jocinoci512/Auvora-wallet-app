# Query balances and transaction history on local Solana validator
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-solana-common.ps1')

$src = '8jFiN4JabxmBwkCVVFnaNyszExbCdd7k2TDuFQHyNThQ'
$recip = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'

$srcBal = Invoke-QaSolanaRpc -Method 'getBalance' -Params @($src)
$recipBal = Invoke-QaSolanaRpc -Method 'getBalance' -Params @($recip)

Write-Host "=== BALANCES ==="
Write-Host "Source (8jFi...):       $($srcBal.value) lamports ($([math]::Round([long]$srcBal.value / 1e9, 6)) SOL)"
Write-Host "Recipient (HAgk...):    $($recipBal.value) lamports ($([math]::Round([long]$recipBal.value / 1e9, 6)) SOL)"

Write-Host "`n=== SIGNATURES FOR SOURCE ==="
$srcSigs = Invoke-QaSolanaRpc -Method 'getSignaturesForAddress' -Params @($src, @{ limit = 10 })
foreach ($s in $srcSigs) {
    Write-Host "Sig: $($s.signature) | Slot: $($s.slot) | Err: $($s.err) | Memo: $($s.memo)"
}

Write-Host "`n=== SIGNATURES FOR RECIPIENT ==="
$recipSigs = Invoke-QaSolanaRpc -Method 'getSignaturesForAddress' -Params @($recip, @{ limit = 10 })
foreach ($s in $recipSigs) {
    Write-Host "Sig: $($s.signature) | Slot: $($s.slot) | Err: $($s.err) | Memo: $($s.memo)"
}
