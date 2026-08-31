#!/usr/bin/env node
/** LOCAL QA — smoke test on-chain completion API */
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ''),
      ];
    }),
);
const secret = env.JWT_ACCESS_SECRET;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (claims) => {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const b = b64({ ...claims, iat: now, exp: now + 3600 });
  const s = createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${s}`;
};
const token = sign({
  sub: 'df1db712-5e50-42c1-92fc-2c7236244cf8',
  email: 'qa@local',
  sessionId: randomUUID(),
  roles: ['user'],
  permissions: ['wallets:read', 'wallets:write'],
});
const body = {
  txHash: '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f',
  chainId: 31337,
  networkLabel: 'Auvora Local EVM QA',
  assetCode: 'ETH',
  amount: '0.0001',
  fromAddress: '0x1d549b12f406ec094cdc4e796cf64394e06a32b5',
  toAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  blockNumber: 1234,
};
for (const base of ['http://127.0.0.1:3002', 'http://127.0.0.1:4000']) {
  for (const label of ['FIRST', 'SECOND']) {
    const res = await fetch(`${base}/api/v1/wallets/transfers/on-chain/complete`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log(base, label, res.status, await res.text());
  }
}
