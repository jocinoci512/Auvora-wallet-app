const baseUrl = 'https://gateway-production-bc6a.up.railway.app';

async function testPublic() {
  console.log('Testing Railway staging public endpoints...');

  // 1. Root / ready
  const readyRes = await fetch(baseUrl + '/ready');
  console.log('/ready status:', readyRes.status, await readyRes.json().catch(() => null));

  // 2. Auth health
  const authHealth = await fetch(baseUrl + '/api/v1/auth/health');
  console.log(
    '/api/v1/auth/health status:',
    authHealth.status,
    await authHealth.json().catch(() => null),
  );

  // 3. Wallet health
  const walletHealth = await fetch(baseUrl + '/api/v1/wallet/health');
  console.log(
    '/api/v1/wallet/health status:',
    walletHealth.status,
    await walletHealth.json().catch(() => null),
  );

  // 4. Blockchain health
  const bcHealth = await fetch(baseUrl + '/api/v1/blockchain/health');
  console.log(
    '/api/v1/blockchain/health status:',
    bcHealth.status,
    await bcHealth.json().catch(() => null),
  );

  // 5. Connections health
  const connHealth = await fetch(baseUrl + '/api/v1/connections/health');
  console.log(
    '/api/v1/connections/health status:',
    connHealth.status,
    await connHealth.json().catch(() => null),
  );

  // 6. Market data health
  const mdHealth = await fetch(baseUrl + '/api/v1/market-data/health');
  console.log(
    '/api/v1/market-data/health status:',
    mdHealth.status,
    await mdHealth.json().catch(() => null),
  );
}

testPublic().catch(console.error);
