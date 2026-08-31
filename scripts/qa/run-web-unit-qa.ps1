$ErrorActionPreference='Continue'
$out='D:\auvora-wallet\.web-tests.txt'
$env:NODE_OPTIONS='--max-old-space-size=768'
Set-Location D:\auvora-wallet
pnpm --filter @auvora/web exec jest --testPathPattern='derive-public-accounts|wallet-empty-copy|status-copy|api-client.format-error' --forceExit *>&1 | Tee-Object -FilePath $out
Add-Content $out 'TEST_DONE'
