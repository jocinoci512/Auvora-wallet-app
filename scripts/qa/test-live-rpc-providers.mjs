import { execSync } from 'node:child_process';

// Fetch the production ALCHEMY_API_KEY from Railway safely into process memory
function getProductionAlchemyKey() {
  const cmd =
    'pnpm dlx @railway/cli variable list --project 458e0c14-654e-4d96-8009-4b70b2279cf8 --environment production --service blockchain-prod --json';
  const raw = execSync(cmd, { encoding: 'utf8' });
  const vars = JSON.parse(raw);
  return vars.ALCHEMY_API_KEY?.trim();
}

const key = getProductionAlchemyKey();
if (!key) {
  console.error('ERROR: No ALCHEMY_API_KEY found in Railway blockchain-prod.');
  process.exit(1);
}
console.log(
  `Successfully retrieved ALCHEMY_API_KEY (length=${key.length}, prefix=${key.slice(0, 4)}••••)`,
);

const targets = [
  // ── ETHEREUM ───────────────────────────────────────────────
  {
    chain: 'ETHEREUM',
    network: 'Sepolia (Testnet)',
    url: `https://eth-sepolia.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'eth-sepolia.g.alchemy.com/v2/[REDACTED]',
    method: 'eth_blockNumber',
    params: [],
    parser: (res) => `Block #${parseInt(res.result, 16)}`,
  },
  {
    chain: 'ETHEREUM',
    network: 'Mainnet (Read)',
    url: `https://eth-mainnet.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'eth-mainnet.g.alchemy.com/v2/[REDACTED]',
    method: 'eth_blockNumber',
    params: [],
    parser: (res) => `Block #${parseInt(res.result, 16)}`,
  },

  // ── POLYGON ────────────────────────────────────────────────
  {
    chain: 'POLYGON',
    network: 'Amoy (Testnet)',
    url: `https://polygon-amoy.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'polygon-amoy.g.alchemy.com/v2/[REDACTED]',
    method: 'eth_blockNumber',
    params: [],
    parser: (res) => `Block #${parseInt(res.result, 16)}`,
  },
  {
    chain: 'POLYGON',
    network: 'Mainnet (Read)',
    url: `https://polygon-mainnet.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'polygon-mainnet.g.alchemy.com/v2/[REDACTED]',
    method: 'eth_blockNumber',
    params: [],
    parser: (res) => `Block #${parseInt(res.result, 16)}`,
  },

  // ── BNB SMART CHAIN ────────────────────────────────────────
  {
    chain: 'BNB',
    network: 'BSC Testnet',
    url: `https://bnb-testnet.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'bnb-testnet.g.alchemy.com/v2/[REDACTED]',
    method: 'eth_blockNumber',
    params: [],
    parser: (res) => `Block #${parseInt(res.result, 16)}`,
  },
  {
    chain: 'BNB',
    network: 'Mainnet (Read)',
    url: `https://bnb-mainnet.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'bnb-mainnet.g.alchemy.com/v2/[REDACTED]',
    method: 'eth_blockNumber',
    params: [],
    parser: (res) => `Block #${parseInt(res.result, 16)}`,
  },

  // ── SOLANA ─────────────────────────────────────────────────
  {
    chain: 'SOLANA',
    network: 'Devnet',
    url: `https://solana-devnet.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'solana-devnet.g.alchemy.com/v2/[REDACTED]',
    method: 'getSlot',
    params: [],
    parser: (res) => `Slot #${res.result}`,
  },
  {
    chain: 'SOLANA',
    network: 'Mainnet-beta (Read)',
    url: `https://solana-mainnet.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'solana-mainnet.g.alchemy.com/v2/[REDACTED]',
    method: 'getSlot',
    params: [],
    parser: (res) => `Slot #${res.result}`,
  },

  // ── BITCOIN ────────────────────────────────────────────────
  {
    chain: 'BITCOIN',
    network: 'Testnet3',
    url: `https://bitcoin-testnet.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'bitcoin-testnet.g.alchemy.com/v2/[REDACTED]',
    method: 'getblockcount',
    params: [],
    parser: (res) => `BlockCount #${res.result}`,
  },
  {
    chain: 'BITCOIN',
    network: 'Mainnet (Read)',
    url: `https://bitcoin-mainnet.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'bitcoin-mainnet.g.alchemy.com/v2/[REDACTED]',
    method: 'getblockcount',
    params: [],
    parser: (res) => `BlockCount #${res.result}`,
  },

  // ── TRON ───────────────────────────────────────────────────
  {
    chain: 'TRON',
    network: 'Nile (Testnet)',
    url: `https://tron-nile.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'tron-nile.g.alchemy.com/v2/[REDACTED]',
    method: 'eth_blockNumber',
    params: [],
    parser: (res) => `Block #${parseInt(res.result, 16)}`,
  },
  {
    chain: 'TRON',
    network: 'Mainnet (Read)',
    url: `https://tron-mainnet.g.alchemy.com/v2/${key}`,
    safeEndpoint: 'tron-mainnet.g.alchemy.com/v2/[REDACTED]',
    method: 'eth_blockNumber',
    params: [],
    parser: (res) => `Block #${parseInt(res.result, 16)}`,
  },
];

// Fallback public providers for non-Alchemy chains/endpoints
const publicFallbacks = [
  {
    chain: 'BITCOIN',
    network: 'Testnet3 (Mempool Public Fallback)',
    url: 'https://mempool.space/testnet/api/blocks/tip/height',
    type: 'rest',
  },
  {
    chain: 'BITCOIN',
    network: 'Mainnet (Mempool Public Fallback)',
    url: 'https://mempool.space/api/blocks/tip/height',
    type: 'rest',
  },
  {
    chain: 'TRON',
    network: 'Nile (TronGrid Public Fallback)',
    url: 'https://nile.trongrid.io/wallet/getnowblock',
    type: 'rest-post',
  },
  {
    chain: 'TRON',
    network: 'Mainnet (TronGrid Public Fallback)',
    url: 'https://api.trongrid.io/wallet/getnowblock',
    type: 'rest-post',
  },
];

async function runTests() {
  console.log('\n=== Testing Alchemy RPC Across All 6 Chains (Testnet & Mainnet Read) ===\n');

  for (const t of targets) {
    const started = Date.now();
    try {
      const resp = await fetch(t.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: t.method, params: t.params }),
      });
      const latency = Date.now() - started;
      const text = await resp.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (resp.ok && parsed && parsed.result !== undefined) {
        console.log(
          `[PASS] ${t.chain.padEnd(8)} | ${t.network.padEnd(24)} | Status: ${resp.status} | Latency: ${latency}ms | Info: ${t.parser(parsed)}`,
        );
      } else {
        const errMsg = parsed?.error?.message || text.slice(0, 100);
        console.log(
          `[FAIL] ${t.chain.padEnd(8)} | ${t.network.padEnd(24)} | Status: ${resp.status} | Latency: ${latency}ms | Err: ${errMsg}`,
        );
      }
    } catch (err) {
      console.log(
        `[ERR ] ${t.chain.padEnd(8)} | ${t.network.padEnd(24)} | Latency: ${Date.now() - started}ms | Err: ${err.message}`,
      );
    }
  }

  console.log('\n=== Testing Public Fallback Endpoints for Bitcoin and Tron ===\n');
  for (const f of publicFallbacks) {
    const started = Date.now();
    try {
      const resp =
        f.type === 'rest-post'
          ? await fetch(f.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            })
          : await fetch(f.url);
      const latency = Date.now() - started;
      const text = await resp.text();
      if (resp.ok) {
        const summary = text.length > 50 ? `${text.slice(0, 40)}...` : text.trim();
        console.log(
          `[PASS] ${f.chain.padEnd(8)} | ${f.network.padEnd(35)} | Status: ${resp.status} | Latency: ${latency}ms | Info: ${summary}`,
        );
      } else {
        console.log(
          `[FAIL] ${f.chain.padEnd(8)} | ${f.network.padEnd(35)} | Status: ${resp.status} | Latency: ${latency}ms | Err: ${text.slice(0, 100)}`,
        );
      }
    } catch (err) {
      console.log(
        `[ERR ] ${f.chain.padEnd(8)} | ${f.network.padEnd(35)} | Latency: ${Date.now() - started}ms | Err: ${err.message}`,
      );
    }
  }
}

runTests().catch(console.error);
