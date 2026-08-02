/**
 * Extended Alchemy live verification: RPC (incl. Polygon), Prices API, public failover.
 * Reads ALCHEMY_API_KEY from process env / root .env. Never prints the key.
 *
 * Usage: node scripts/verify-alchemy-live.mjs
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

function redact(url) {
  return String(url)
    .replace(/\/v2\/[^/?#]+/i, '/v2/[REDACTED]')
    .replace(/\/prices\/v1\/[^/?#]+/i, '/prices/v1/[REDACTED]');
}

function classifyAuth(status, ok) {
  if (status === 401 || status === 403) return 'INVALID';
  if (status === 429) return 'RATE_LIMITED';
  if (ok) return 'VALID';
  if (status === 0) return 'MISCONFIGURED';
  return 'CHECK';
}

async function jsonRpc(name, url, method, params = []) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    const ok = res.ok && !body.error && body.result !== undefined;
    return {
      name,
      ok,
      status: res.status,
      latencyMs: Date.now() - started,
      endpoint: redact(url),
      auth: classifyAuth(res.status, ok),
      preview:
        typeof body.result === 'string'
          ? body.result.slice(0, 24)
          : body.error?.message?.slice(0, 120) || (ok ? 'ok' : `HTTP ${res.status}`),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      endpoint: redact(url),
      auth: 'MISCONFIGURED',
      preview: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getTip(name, url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    const ok = res.ok && text.trim().length > 0;
    return {
      name,
      ok,
      status: res.status,
      latencyMs: Date.now() - started,
      endpoint: url,
      auth: ok ? 'PUBLIC_OK' : 'CHECK',
      preview: text.slice(0, 24),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      endpoint: url,
      auth: 'MISCONFIGURED',
      preview: error instanceof Error ? error.message : String(error),
    };
  }
}

async function alchemyPrices() {
  const base = `https://api.g.alchemy.com/prices/v1/${key}/tokens/by-symbol`;
  const params = new URLSearchParams();
  for (const s of ['ETH', 'BTC', 'SOL', 'BNB', 'POL', 'TRX', 'USDC', 'USDT']) {
    params.append('symbols', s);
  }
  const url = `${base}?${params.toString()}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    const rows = Array.isArray(body.data) ? body.data : [];
    const priced = rows.filter(
      (r) =>
        Array.isArray(r.prices) &&
        r.prices.some((p) => p.currency === 'usd' || p.currency === 'USD'),
    );
    const ok = res.ok && priced.length > 0;
    return {
      name: 'AlchemyPrices',
      ok,
      status: res.status,
      latencyMs: Date.now() - started,
      endpoint: redact(url),
      auth: classifyAuth(res.status, ok),
      preview: `symbols_priced=${priced.length}/${rows.length}`,
    };
  } catch (error) {
    return {
      name: 'AlchemyPrices',
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      endpoint: redact(base),
      auth: 'MISCONFIGURED',
      preview: error instanceof Error ? error.message : String(error),
    };
  }
}

const alchemyRpc = [
  {
    name: 'Ethereum',
    url: process.env.ALCHEMY_ETHEREUM_RPC_URL || `https://eth-mainnet.g.alchemy.com/v2/${key}`,
    method: 'eth_blockNumber',
  },
  {
    name: 'Polygon',
    url: process.env.ALCHEMY_POLYGON_RPC_URL || `https://polygon-mainnet.g.alchemy.com/v2/${key}`,
    method: 'eth_blockNumber',
  },
  {
    name: 'PolygonChainId',
    url: process.env.ALCHEMY_POLYGON_RPC_URL || `https://polygon-mainnet.g.alchemy.com/v2/${key}`,
    method: 'eth_chainId',
  },
  {
    name: 'BNB Smart Chain',
    url: process.env.ALCHEMY_BSC_RPC_URL || `https://bnb-mainnet.g.alchemy.com/v2/${key}`,
    method: 'eth_blockNumber',
  },
  {
    name: 'Solana',
    url: process.env.ALCHEMY_SOLANA_RPC_URL || `https://solana-mainnet.g.alchemy.com/v2/${key}`,
    method: 'getHealth',
  },
  {
    name: 'Tron',
    url: process.env.ALCHEMY_TRON_RPC_URL || `https://tron-mainnet.g.alchemy.com/v2/${key}`,
    method: 'eth_blockNumber',
  },
  {
    name: 'Bitcoin',
    url: process.env.ALCHEMY_BITCOIN_RPC_URL || `https://bitcoin-mainnet.g.alchemy.com/v2/${key}`,
    method: 'getblockcount',
  },
];

const publicRpc = [
  { name: 'PublicETH', url: 'https://ethereum.publicnode.com', method: 'eth_blockNumber' },
  { name: 'PublicPolygon', url: 'https://polygon-bor.publicnode.com', method: 'eth_blockNumber' },
  { name: 'PublicBSC', url: 'https://bsc.publicnode.com', method: 'eth_blockNumber' },
  { name: 'PublicSolana', url: 'https://api.mainnet-beta.solana.com', method: 'getHealth' },
  { name: 'PublicSolana2', url: 'https://solana-rpc.publicnode.com', method: 'getHealth' },
];

const results = [];
for (const chain of alchemyRpc) {
  results.push(await jsonRpc(chain.name, chain.url, chain.method));
}
results.push(await alchemyPrices());
for (const chain of publicRpc) {
  results.push(await jsonRpc(chain.name, chain.url, chain.method));
}
results.push(await getTip('PublicBTC', 'https://mempool.space/api/blocks/tip/height'));
results.push(await getTip('PublicBTC2', 'https://blockstream.info/api/blocks/tip/height'));
results.push(await getTip('PublicTron', 'https://api.trongrid.io/wallet/getnowblock'));

const polygonChainId = results.find((r) => r.name === 'PolygonChainId');
const polygonOk =
  results.find((r) => r.name === 'Polygon')?.ok &&
  polygonChainId?.ok &&
  String(polygonChainId.preview).toLowerCase() === '0x89';

console.log(
  JSON.stringify(
    {
      alchemyConfigured: true,
      polygonChainIdExpected: '0x89 (137)',
      polygonChainIdVerified: Boolean(polygonOk),
      results,
    },
    null,
    2,
  ),
);

const critical = [
  'Ethereum',
  'Polygon',
  'BNB Smart Chain',
  'Solana',
  'Tron',
  'Bitcoin',
  'AlchemyPrices',
];
const failed = results.filter((r) => critical.includes(r.name) && !r.ok);
process.exit(failed.length ? 2 : 0);
