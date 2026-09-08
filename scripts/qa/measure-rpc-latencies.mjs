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
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const t1 = performance.now();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return { result: json.result, latencyMs: Math.round(t1 - t0) };
}

async function measure() {
  console.log('=== Measuring Representative RPC Latencies (ms) ===\n');

  // 1. Ethereum
  const ethUrl = `https://eth-mainnet.g.alchemy.com/v2/${key}`;
  const ethBlock = await rpcCall(ethUrl, 'eth_blockNumber');
  const ethBal = await rpcCall(ethUrl, 'eth_getBalance', [
    '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    'latest',
  ]);
  const ethFee = await rpcCall(ethUrl, 'eth_gasPrice');
  const ethTx = await rpcCall(ethUrl, 'eth_getTransactionByHash', [
    '0x5c504ed432cb51138b309aa5ac7056091868153022db18d3d026360d48f4f41f',
  ]);
  console.log(
    `ETHEREUM: Block: ${ethBlock.latencyMs}ms | Balance: ${ethBal.latencyMs}ms | Fee: ${ethFee.latencyMs}ms | Tx: ${ethTx.latencyMs}ms | Avg: ${Math.round((ethBlock.latencyMs + ethBal.latencyMs + ethFee.latencyMs + ethTx.latencyMs) / 4)}ms`,
  );

  // 2. BNB Smart Chain
  const bscUrl = `https://bnb-mainnet.g.alchemy.com/v2/${key}`;
  const bscBlock = await rpcCall(bscUrl, 'eth_blockNumber');
  const bscBal = await rpcCall(bscUrl, 'eth_getBalance', [
    '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
    'latest',
  ]);
  const bscFee = await rpcCall(bscUrl, 'eth_gasPrice');
  console.log(
    `BNB     : Block: ${bscBlock.latencyMs}ms | Balance: ${bscBal.latencyMs}ms | Fee: ${bscFee.latencyMs}ms | Avg: ${Math.round((bscBlock.latencyMs + bscBal.latencyMs + bscFee.latencyMs) / 3)}ms`,
  );

  // 3. Polygon
  const polUrl = `https://polygon-mainnet.g.alchemy.com/v2/${key}`;
  const polBlock = await rpcCall(polUrl, 'eth_blockNumber');
  const polBal = await rpcCall(polUrl, 'eth_getBalance', [
    '0x0000000000000000000000000000000000001010',
    'latest',
  ]);
  const polFee = await rpcCall(polUrl, 'eth_gasPrice');
  console.log(
    `POLYGON : Block: ${polBlock.latencyMs}ms | Balance: ${polBal.latencyMs}ms | Fee: ${polFee.latencyMs}ms | Avg: ${Math.round((polBlock.latencyMs + polBal.latencyMs + polFee.latencyMs) / 3)}ms`,
  );

  // 4. Solana
  const solUrl = `https://solana-mainnet.g.alchemy.com/v2/${key}`;
  const solBlock = await rpcCall(solUrl, 'getSlot');
  const solBal = await rpcCall(solUrl, 'getBalance', [
    'Vote111111111111111111111111111111111111111',
  ]);
  const solFee = await rpcCall(solUrl, 'getLatestBlockhash');
  console.log(
    `SOLANA  : Slot : ${solBlock.latencyMs}ms | Balance: ${solBal.latencyMs}ms | Fee: ${solFee.latencyMs}ms | Avg: ${Math.round((solBlock.latencyMs + solBal.latencyMs + solFee.latencyMs) / 3)}ms`,
  );

  // 5. Bitcoin
  const btcUrl = `https://bitcoin-mainnet.g.alchemy.com/v2/${key}`;
  const btcBlock = await rpcCall(btcUrl, 'getblockcount');
  const btcFee = await rpcCall(btcUrl, 'estimatesmartfee', [6]);
  console.log(
    `BITCOIN : Tip  : ${btcBlock.latencyMs}ms | Fee: ${btcFee.latencyMs}ms | Avg: ${Math.round((btcBlock.latencyMs + btcFee.latencyMs) / 2)}ms`,
  );

  // 6. Tron
  const tronUrl = `https://tron-mainnet.g.alchemy.com/v2/${key}`;
  const tronBlock = await rpcCall(tronUrl, 'eth_blockNumber');
  const tronBal = await rpcCall(tronUrl, 'eth_getBalance', [
    '41b4e23aa3a787ee9bf99bf72ef8c1300aaecabce6',
    'latest',
  ]);
  console.log(
    `TRON    : Block: ${tronBlock.latencyMs}ms | Balance: ${tronBal.latencyMs}ms | Avg: ${Math.round((tronBlock.latencyMs + tronBal.latencyMs) / 2)}ms`,
  );
}

measure().catch(console.error);
