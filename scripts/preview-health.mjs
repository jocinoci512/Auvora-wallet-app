#!/usr/bin/env node
/**
 * Quick preview health check for web (:3000) and admin (:3001).
 * Usage: node scripts/preview-health.mjs
 */
const webBase = (process.env.WEB_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const adminBase = (process.env.ADMIN_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

const webPaths = [
  '/',
  '/dashboard',
  '/portfolio',
  '/wallets',
  '/send',
  '/receive',
  '/swap',
  '/bridge',
  '/staking',
  '/nfts',
  '/web3',
  '/settings',
  '/security',
  '/notifications',
  '/activity',
  '/status',
];
const adminPaths = ['/', '/wallets', '/blockchain', '/observability', '/design-system'];

async function check(base, path) {
  const url = `${base}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    const ok = res.status >= 200 && res.status < 400 && !/Internal Server Error/i.test(text);
    return { path, status: res.status, ok, ms: Date.now() - started, len: text.length };
  } catch (error) {
    return {
      path,
      status: 0,
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkHeaders(base) {
  const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(10000) });
  return {
    xFrameOptions: res.headers.get('x-frame-options'),
    coop: res.headers.get('cross-origin-opener-policy'),
    corp: res.headers.get('cross-origin-resource-policy'),
  };
}

const webResults = [];
for (const path of webPaths) {
  webResults.push(await check(webBase, path));
}
const adminResults = [];
for (const path of adminPaths) {
  adminResults.push(await check(adminBase, path));
}

let headers = null;
try {
  headers = await checkHeaders(webBase);
} catch {
  headers = { error: 'web headers unavailable' };
}

const failed = [...webResults, ...adminResults].filter((r) => !r.ok);
const report = {
  generatedAt: new Date().toISOString(),
  webBase,
  adminBase,
  headers,
  web: {
    passed: webResults.filter((r) => r.ok).length,
    failed: webResults.filter((r) => !r.ok).length,
    results: webResults,
  },
  admin: {
    passed: adminResults.filter((r) => r.ok).length,
    failed: adminResults.filter((r) => !r.ok).length,
    results: adminResults,
  },
  ok: failed.length === 0 && !headers?.xFrameOptions,
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
