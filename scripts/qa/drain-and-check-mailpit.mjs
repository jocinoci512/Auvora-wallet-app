#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = {
  ...Object.fromEntries(
    fs
      .readFileSync(path.join(root, '.env'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  ),
  ...process.env,
};
const key = env.INTERNAL_API_KEY;
const drain = await fetch('http://127.0.0.1:3006/api/v1/internal/notifications/qa/drain-queue', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-internal-api-key': key },
  body: JSON.stringify({ maxItems: 50 }),
});
console.log('DRAIN', await drain.text());
const mail = await (await fetch('http://127.0.0.1:8025/api/v1/messages?limit=100')).json();
const complete = mail.messages.filter((m) => /complete/i.test(m.Subject));
console.log(
  'MAILPIT_COMPLETE',
  complete.map((m) => m.Subject),
);
