#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';

const adb = 'D:\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'R5CW51ZMNLB';
execFileSync(adb, ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/ui.xml']);
execFileSync(adb, ['-s', serial, 'pull', '/sdcard/ui.xml', 'artifacts/ui-sol-ready-final.xml']);
const t = fs.readFileSync('artifacts/ui-sol-ready-final.xml', 'utf8');
const texts = [
  ...[...t.matchAll(/content-desc="([^"]+)"/g)].map((m) => m[1].replace(/&#10;/g, ' ')),
  ...[...t.matchAll(/\btext="([^"]+)"/g)].map((m) => m[1]),
].filter(Boolean);
const j = texts.join(' | ');

function rpc(body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8899,
        path: '/',
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(JSON.parse(d)));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const health = await rpc(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }));
const bal = await rpc(
  JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getBalance',
    params: ['8jFiN4JabxmBwkCVVFnaNyszExbCdd7k2TDuFQHyNThQ'],
  }),
);
const bh = await rpc(
  JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getLatestBlockhash',
    params: [{ commitment: 'confirmed' }],
  }),
);

const feeText = (j.match(/Network fee\s+[0-9.]+\s*SOL[^|]*/i) || [])[0] || null;
console.log(
  JSON.stringify(
    {
      ready: /Step 5 of 8|Status Ready|Nothing has been signed/i.test(j),
      network: /Auvora Local Solana QA/i.test(j),
      amount: /0\.000100/.test(j),
      recipient: /HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk/.test(j),
      feeText,
      signCta: /Sign on this device/i.test(j),
      mainnetOff: /mainnet OFF|MAINNET OFF/i.test(j),
      health: health.result,
      balanceLamports: bal.result?.value,
      blockhash: bh.result?.value?.blockhash,
      sample: texts.slice(0, 20),
    },
    null,
    2,
  ),
);
