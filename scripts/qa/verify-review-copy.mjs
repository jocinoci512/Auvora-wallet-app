import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const QA_USER_ID = 'df1db712-5e50-42c1-92fc-2c7236244cf8';
const GATEWAY = 'http://127.0.0.1:4000';
const envText = fs.readFileSync(path.join(root, '.env'), 'utf8');
const secret = envText
  .split('\n')
  .find((l) => l.startsWith('JWT_ACCESS_SECRET='))
  ?.slice('JWT_ACCESS_SECRET='.length)
  .trim()
  .replace(/^['"]|['"]$/g, '');
if (!secret) throw new Error('missing secret');

function signJwt(claims) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...claims, iat: now, exp: now + 600 })).toString(
    'base64url',
  );
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const token = signJwt({
  sub: QA_USER_ID,
  email: 'qa-local@invalid',
  sessionId: randomUUID(),
  roles: ['user'],
  permissions: ['wallets:read', 'notification:read'],
  surface: 'consumer',
});

const ids = {
  pending: 'a4553c3b-a05c-40cd-84e6-cfce724214c3',
  rejected: '716cb9ca-42fc-4b24-9526-8a98ccc05b4c',
  approved: '89970795-e800-4b23-b72d-e3913822ef59',
};

for (const [label, id] of Object.entries(ids)) {
  const res = await fetch(`${GATEWAY}/api/v1/wallets/transfers/reviews/${id}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  const d = json.data ?? json;
  const blob = JSON.stringify(d);
  console.log(
    [
      label,
      res.status,
      d.customerStatus,
      `reason=${d.customerReason ? 'yes' : 'no'}`,
      `internal=${blob.includes('Physical QA rejection test')}`,
      `codes=${/below_threshold|kyc_satisfied|policy_result/.test(blob)}`,
    ].join(' '),
  );
}

const inbox = await fetch(`${GATEWAY}/api/v1/notifications`, {
  headers: { accept: 'application/json', authorization: `Bearer ${token}` },
});
const items = (await inbox.json()).data?.items ?? [];
const channels = [...new Set(items.map((i) => i.channel))];
const kyc = items.filter((i) =>
  String(i.subject ?? '')
    .toLowerCase()
    .includes('verification approved'),
);
console.log(
  `inbox n=${items.length} channels=${channels.join(',') || 'none'} kycTitles=${kyc.map((i) => i.subject).join('|') || 'none'}`,
);
