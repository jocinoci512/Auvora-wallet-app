#!/usr/bin/env node
/**
 * LOCAL QA — publish wallet.transfer.completed for the known device tx
 * when Anvil no longer has the receipt (state was not persisted).
 * Uses notifications internal API only; does not touch chain or user keys.
 */
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

const txHash = '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f';
const body = {
  eventType: 'wallet.transfer.completed',
  aggregateId: txHash,
  payload: {
    ownerUserId: 'df1db712-5e50-42c1-92fc-2c7236244cf8',
    txHash,
    hash: txHash,
    assetCode: 'ETH',
    amount: '0.0001',
    networkLabel: 'Auvora Local EVM QA',
    network: 'Auvora Local EVM QA',
    fromAddress: '0x1d549b12f406ec094cdc4e796cf64394e06a32b5',
    toAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    blockNumber: 1234,
  },
  correlationId: randomUUID(),
};

const res = await fetch('http://127.0.0.1:3006/api/v1/internal/notifications/events', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-internal-api-key': env.INTERNAL_API_KEY,
  },
  body: JSON.stringify(body),
});
console.log('PUBLISH', res.status, await res.text());

const drain = await fetch('http://127.0.0.1:3006/api/v1/internal/notifications/qa/drain-queue', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-internal-api-key': env.INTERNAL_API_KEY,
  },
  body: JSON.stringify({ maxItems: 20 }),
});
console.log('DRAIN', await drain.text());

const mail = await (await fetch('http://127.0.0.1:8025/api/v1/messages?limit=100')).json();
const hits = mail.messages.filter(
  (m) =>
    /transfer is complete|transaction completed/i.test(m.Subject) ||
    (m.Snippet && String(m.Snippet).includes(txHash.slice(0, 10))),
);
console.log(
  'MAILPIT_TX_COMPLETED',
  hits.map((m) => ({ subject: m.Subject, id: m.ID })),
);
console.log('MAILPIT_TOTAL', mail.total);
