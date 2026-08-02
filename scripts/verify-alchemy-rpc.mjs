/**
 * Live Alchemy connectivity probe for the five enabled mainnets.
 * Reads ALCHEMY_API_KEY from process env / root .env. Never prints the key.
 *
 * Usage: node scripts/verify-alchemy-rpc.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnv();

const key = process.env.ALCHEMY_API_KEY;
if (!key) {
  console.error('FAIL: ALCHEMY_API_KEY missing');
  process.exit(1);
}

const chains = [
  {
    name: 'Ethereum',
    url: process.env.ALCHEMY_ETHEREUM_RPC_URL || `https://eth-mainnet.g.alchemy.com/v2/${key}`,
    method: 'eth_blockNumber',
    params: [],
  },
  {
    name: 'Polygon',
    url: process.env.ALCHEMY_POLYGON_RPC_URL || `https://polygon-mainnet.g.alchemy.com/v2/${key}`,
    method: 'eth_blockNumber',
    params: [],
  },
  {
    name: 'BNB Smart Chain',
    url: process.env.ALCHEMY_BSC_RPC_URL || `https://bnb-mainnet.g.alchemy.com/v2/${key}`,
    method: 'eth_blockNumber',
    params: [],
  },
  {
    name: 'Solana',
    url: process.env.ALCHEMY_SOLANA_RPC_URL || `https://solana-mainnet.g.alchemy.com/v2/${key}`,
    method: 'getHealth',
    params: [],
  },
  {
    name: 'Tron',
    url: process.env.ALCHEMY_TRON_RPC_URL || `https://tron-mainnet.g.alchemy.com/v2/${key}`,
    method: 'eth_blockNumber',
    params: [],
  },
  {
    name: 'Bitcoin',
    url: process.env.ALCHEMY_BITCOIN_RPC_URL || `https://bitcoin-mainnet.g.alchemy.com/v2/${key}`,
    method: 'getblockcount',
    params: [],
  },
];

function redact(url) {
  return url.replace(/\/v2\/[^/?#]+/i, '/v2/[REDACTED]');
}

const results = [];
for (const chain of chains) {
  const started = Date.now();
  try {
    const res = await fetch(chain.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: chain.method, params: chain.params }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    const ok = res.ok && !body.error && body.result !== undefined;
    results.push({
      chain: chain.name,
      ok,
      status: res.status,
      latencyMs: Date.now() - started,
      endpoint: redact(chain.url),
      resultPreview:
        typeof body.result === 'string'
          ? body.result.slice(0, 24)
          : body.error?.message?.slice(0, 120) || (ok ? 'ok' : `HTTP ${res.status}`),
    });
  } catch (error) {
    results.push({
      chain: chain.name,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      endpoint: redact(chain.url),
      resultPreview: error instanceof Error ? error.message : String(error),
    });
  }
}

console.log(JSON.stringify({ alchemyConfigured: true, results }, null, 2));
const failed = results.filter((r) => !r.ok);
process.exit(failed.length ? 2 : 0);
