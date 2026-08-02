/**
 * Generate a modest burst of legitimate Alchemy read-only traffic for dashboard visibility.
 * Never prints the API key.
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

async function rpc(url, method) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
    signal: AbortSignal.timeout(12_000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && !body.error, status: res.status, endpoint: redact(url), method };
}

async function prices() {
  const url = `https://api.g.alchemy.com/prices/v1/${key}/tokens/by-symbol?symbols=ETH&symbols=BTC&symbols=SOL`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  return { ok: res.ok, status: res.status, endpoint: redact(url), method: 'prices' };
}

const hosts = [
  ['eth', 'eth-mainnet.g.alchemy.com', 'eth_blockNumber'],
  ['bsc', 'bnb-mainnet.g.alchemy.com', 'eth_blockNumber'],
  ['sol', 'solana-mainnet.g.alchemy.com', 'getHealth'],
  ['tron', 'tron-mainnet.g.alchemy.com', 'eth_blockNumber'],
  ['btc', 'bitcoin-mainnet.g.alchemy.com', 'getblockcount'],
];

const out = [];
for (let round = 1; round <= 3; round++) {
  for (const [chain, host, method] of hosts) {
    out.push({ round, chain, ...(await rpc(`https://${host}/v2/${key}`, method)) });
  }
  out.push({ round, chain: 'prices', ...(await prices()) });
}

const ok = out.filter((x) => x.ok).length;
console.log(JSON.stringify({ dashboardProbes: out.length, ok, failed: out.length - ok }, null, 2));
process.exit(ok === out.length ? 0 : 2);
