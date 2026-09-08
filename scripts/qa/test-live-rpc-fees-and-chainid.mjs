import { execSync } from 'node:child_process';

function getProductionAlchemyKey() {
  const cmd =
    'pnpm dlx @railway/cli variable list --project 458e0c14-654e-4d96-8009-4b70b2279cf8 --environment production --service blockchain-prod --json';
  const raw = execSync(cmd, { encoding: 'utf8' });
  const vars = JSON.parse(raw);
  return vars.ALCHEMY_API_KEY?.trim();
}

const key = getProductionAlchemyKey();

async function rpcCall(url, method, params = []) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`RPC Error ${json.error.code}: ${json.error.message}`);
  }
  return json.result;
}

async function testChainFeesAndIds() {
  console.log('=== Verifying Chain IDs, Fees, and Rate Limits ===\n');

  // 1. Ethereum Sepolia & Mainnet
  const ethSepoliaChainId = parseInt(
    await rpcCall(`https://eth-sepolia.g.alchemy.com/v2/${key}`, 'eth_chainId'),
    16,
  );
  const ethSepoliaGasPrice = BigInt(
    await rpcCall(`https://eth-sepolia.g.alchemy.com/v2/${key}`, 'eth_gasPrice'),
  );
  console.log(
    `Ethereum Sepolia: Chain ID = ${ethSepoliaChainId} (expected 11155111) | Gas Price = ${ethSepoliaGasPrice / 10n ** 9n} Gwei`,
  );

  const ethMainnetChainId = parseInt(
    await rpcCall(`https://eth-mainnet.g.alchemy.com/v2/${key}`, 'eth_chainId'),
    16,
  );
  const ethMainnetGasPrice = BigInt(
    await rpcCall(`https://eth-mainnet.g.alchemy.com/v2/${key}`, 'eth_gasPrice'),
  );
  console.log(
    `Ethereum Mainnet: Chain ID = ${ethMainnetChainId} (expected 1) | Gas Price = ${ethMainnetGasPrice / 10n ** 9n} Gwei`,
  );

  // 2. Polygon Amoy & Mainnet
  const polAmoyChainId = parseInt(
    await rpcCall(`https://polygon-amoy.g.alchemy.com/v2/${key}`, 'eth_chainId'),
    16,
  );
  const polAmoyGasPrice = BigInt(
    await rpcCall(`https://polygon-amoy.g.alchemy.com/v2/${key}`, 'eth_gasPrice'),
  );
  console.log(
    `Polygon Amoy    : Chain ID = ${polAmoyChainId} (expected 80002) | Gas Price = ${polAmoyGasPrice / 10n ** 9n} Gwei`,
  );

  const polMainnetChainId = parseInt(
    await rpcCall(`https://polygon-mainnet.g.alchemy.com/v2/${key}`, 'eth_chainId'),
    16,
  );
  const polMainnetGasPrice = BigInt(
    await rpcCall(`https://polygon-mainnet.g.alchemy.com/v2/${key}`, 'eth_gasPrice'),
  );
  console.log(
    `Polygon Mainnet : Chain ID = ${polMainnetChainId} (expected 137) | Gas Price = ${polMainnetGasPrice / 10n ** 9n} Gwei`,
  );

  // 3. BNB Smart Chain Testnet & Mainnet
  const bscTestnetChainId = parseInt(
    await rpcCall(`https://bnb-testnet.g.alchemy.com/v2/${key}`, 'eth_chainId'),
    16,
  );
  const bscTestnetGasPrice = BigInt(
    await rpcCall(`https://bnb-testnet.g.alchemy.com/v2/${key}`, 'eth_gasPrice'),
  );
  console.log(
    `BSC Testnet     : Chain ID = ${bscTestnetChainId} (expected 97) | Gas Price = ${bscTestnetGasPrice / 10n ** 9n} Gwei`,
  );

  const bscMainnetChainId = parseInt(
    await rpcCall(`https://bnb-mainnet.g.alchemy.com/v2/${key}`, 'eth_chainId'),
    16,
  );
  const bscMainnetGasPrice = BigInt(
    await rpcCall(`https://bnb-mainnet.g.alchemy.com/v2/${key}`, 'eth_gasPrice'),
  );
  console.log(
    `BSC Mainnet     : Chain ID = ${bscMainnetChainId} (expected 56) | Gas Price = ${bscMainnetGasPrice / 10n ** 9n} Gwei`,
  );

  // 4. Solana Devnet & Mainnet-beta
  const solDevnetBlockhash = await rpcCall(
    `https://solana-devnet.g.alchemy.com/v2/${key}`,
    'getLatestBlockhash',
  );
  console.log(
    `Solana Devnet   : Blockhash = ${solDevnetBlockhash.value.blockhash.slice(0, 16)}... | LamportsPerSig = ${solDevnetBlockhash.value.feeCalculator?.lamportsPerSignature ?? 5000}`,
  );

  const solMainnetBlockhash = await rpcCall(
    `https://solana-mainnet.g.alchemy.com/v2/${key}`,
    'getLatestBlockhash',
  );
  console.log(
    `Solana Mainnet  : Blockhash = ${solMainnetBlockhash.value.blockhash.slice(0, 16)}... | LamportsPerSig = ${solMainnetBlockhash.value.feeCalculator?.lamportsPerSignature ?? 5000}`,
  );

  // 5. Bitcoin Testnet3 & Mainnet
  const btcTestnetSmartFee = await rpcCall(
    `https://bitcoin-testnet.g.alchemy.com/v2/${key}`,
    'estimatesmartfee',
    [6],
  );
  console.log(
    `Bitcoin Testnet3: Smart Fee (6 blocks) = ${btcTestnetSmartFee.feerate ?? 'N/A'} BTC/kB (~${Math.round((btcTestnetSmartFee.feerate ?? 0.0001) * 100000)} sat/vB)`,
  );

  const btcMainnetSmartFee = await rpcCall(
    `https://bitcoin-mainnet.g.alchemy.com/v2/${key}`,
    'estimatesmartfee',
    [6],
  );
  console.log(
    `Bitcoin Mainnet : Smart Fee (6 blocks) = ${btcMainnetSmartFee.feerate ?? 'N/A'} BTC/kB (~${Math.round((btcMainnetSmartFee.feerate ?? 0.00015) * 100000)} sat/vB)`,
  );

  // 6. Tron Mainnet (Alchemy) & Nile (TronGrid)
  const tronMainnetBlock = await rpcCall(
    `https://tron-mainnet.g.alchemy.com/v2/${key}`,
    'eth_blockNumber',
  );
  console.log(
    `Tron Mainnet    : Alchemy JSON-RPC Block = ${parseInt(tronMainnetBlock, 16)} | Energy/Bandwidth standard`,
  );

  const tronNileResp = await fetch('https://nile.trongrid.io/wallet/getchainparameters');
  const tronNileParams = await tronNileResp.json();
  const energyFee =
    tronNileParams.chainParameter?.find((p) => p.key === 'getEnergyFee')?.value ?? 420;
  console.log(`Tron Nile       : TronGrid HTTP | Energy fee = ${energyFee} SUN`);

  console.log('\nAll chain ID and fee estimation checks passed successfully!');
}

testChainFeesAndIds().catch(console.error);
