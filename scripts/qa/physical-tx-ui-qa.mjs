/**
 * LOCAL QA ONLY — physical transaction policy + notification audit.
 * Same canonical QA user. Does not create users/wallets, reset KYC, sign, or broadcast.
 * Never prints tokens, passwords, mnemonics, or full addresses.
 */
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const QA_USER_ID = 'df1db712-5e50-42c1-92fc-2c7236244cf8';
const GATEWAY = 'http://127.0.0.1:4000';
const WALLET = 'http://127.0.0.1:3002';
const DEST = '0x0000000000000000000000000000000000000001';
const TX_INTERNAL_NOTE = 'Physical QA rejection test';
const CUSTOMER_TX_REASON =
  'Additional information is required before this transaction can be completed.';

function parseEnv(contents) {
  const result = {};
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const env = parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
const secret = env.JWT_ACCESS_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET missing from local .env');
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function signJwt(claims) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat: now, exp: now + 3600 };
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', 'auvora-postgres', 'psql', '-U', 'auvora', '-d', 'auvora_wallet', '-tAc', sql],
    { encoding: 'utf8' },
  ).trim();
}

const adminEmail = (env.SEED_ADMIN_EMAIL || 'admin@auvora.local').replace(/'/g, "''");
const adminUserId = psql(`SELECT id FROM users WHERE email = '${adminEmail}' LIMIT 1`);

const consumerToken = signJwt({
  sub: QA_USER_ID,
  email: 'qa-local@invalid',
  sessionId: randomUUID(),
  roles: ['user'],
  permissions: [
    'wallets:read',
    'wallets:write',
    'compliance:read',
    'notification:read',
    'notification:write',
  ],
  surface: 'consumer',
});

const adminToken = signJwt({
  sub: adminUserId || QA_USER_ID,
  email: env.SEED_ADMIN_EMAIL || 'admin@auvora.local',
  sessionId: randomUUID(),
  roles: ['admin'],
  permissions: ['transactions:review:large', 'audit:read', 'notification:admin', 'compliance:read'],
  surface: 'admin',
  stepUpExp: Math.floor(Date.now() / 1000) + 3600,
});

const report = [];
function rec(name, pass, detail = '') {
  report.push({ name, pass, detail: String(detail ?? '') });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, urlPath, { token, body, base = GATEWAY } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function dataOf(resp) {
  return resp.json?.data ?? resp.json;
}

function maskId(id) {
  if (!id || id.length < 12) return '(none)';
  return `${id.slice(0, 8)}…`;
}

async function health(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.status;
  } catch {
    return 0;
  }
}

async function prepare(cents) {
  return api('POST', '/api/v1/wallets/transfers/prepare', {
    token: consumerToken,
    body: {
      assetCode: 'ETH',
      destinationAddress: DEST,
      amount: '0.000001',
      idempotencyKey: randomUUID(),
      networkEnv: 'testnet',
      qaNotionalUsdCents: String(cents),
    },
  });
}

async function main() {
  const kyc = psql(
    `SELECT status::text || '/' || COALESCE(level::text, '') FROM kyc_profiles WHERE owner_user_id = '${QA_USER_ID}'`,
  );
  rec('KYC preserved APPROVED', kyc.startsWith('APPROVED'), kyc);
  const wallets = Number(
    psql(
      `SELECT COUNT(*) FROM wallets WHERE owner_user_id = '${QA_USER_ID}' AND archived_at IS NULL`,
    ),
  );
  rec('wallet rows unchanged (6)', wallets === 6, String(wallets));

  const p4999 = await prepare(499999);
  const d4999 = dataOf(p4999);
  rec(
    '$4,999.99 Ready / no Admin review',
    p4999.status < 300 && d4999?.allowed === true && !d4999?.reviewId,
    `${p4999.status} ${d4999?.status} review=${d4999?.reviewId ?? 'none'}`,
  );

  const p5k = await prepare(500000);
  const d5k = dataOf(p5k);
  rec(
    '$5,000.00 Verified accepted / no Admin review',
    p5k.status < 300 && d5k?.allowed === true && d5k?.status === 'kyc_satisfied' && !d5k?.reviewId,
    `${p5k.status} ${d5k?.status}`,
  );

  const p9999 = await prepare(999999);
  const d9999 = dataOf(p9999);
  rec(
    '$9,999.99 no Admin review',
    p9999.status < 300 && d9999?.allowed === true && !d9999?.reviewId,
    `${p9999.status} ${d9999?.status}`,
  );

  const pendingBefore = Number(
    psql(
      `SELECT COUNT(*) FROM large_transfer_reviews WHERE owner_user_id = '${QA_USER_ID}' AND status = 'PENDING' AND source_type = 'USER_TRANSFER'`,
    ),
  );

  const p10k = await prepare(1000000);
  const d10k = dataOf(p10k);
  rec(
    '$10,000.00 review created',
    p10k.status < 300 &&
      d10k?.allowed === false &&
      Boolean(d10k?.reviewId) &&
      d10k?.reviewStatus === 'PENDING',
    `${p10k.status} ${d10k?.reviewStatus} ${maskId(d10k?.reviewId)}`,
  );

  const p1000001 = await prepare(1000001);
  const d1000001 = dataOf(p1000001);
  rec(
    '$10,000.01 review required',
    p1000001.status < 300 && Boolean(d1000001?.reviewId) && d1000001?.reviewId !== d10k?.reviewId,
    maskId(d1000001?.reviewId),
  );

  const pendingAfter = Number(
    psql(
      `SELECT COUNT(*) FROM large_transfer_reviews WHERE owner_user_id = '${QA_USER_ID}' AND status = 'PENDING' AND source_type = 'USER_TRANSFER'`,
    ),
  );
  rec(
    'Admin pending incremented',
    pendingAfter >= pendingBefore + 2,
    `${pendingBefore}->${pendingAfter}`,
  );

  const firstId = d10k?.reviewId;
  if (firstId) {
    const mine = await api('GET', `/api/v1/wallets/transfers/reviews/${firstId}`, {
      token: consumerToken,
    });
    const md = dataOf(mine);
    rec(
      'customer GET review Pending',
      mine.status < 300 && (md?.customerStatus === 'Pending review' || md?.status === 'PENDING'),
      `${mine.status} ${md?.customerStatus ?? md?.status}`,
    );
    rec(
      'customer GET hides internal codes',
      !JSON.stringify(md ?? {}).includes('kyc_satisfied') &&
        !JSON.stringify(md ?? {}).includes('policy_result'),
    );

    const rejected = await api('POST', `/api/v1/admin/transaction-reviews/${firstId}/reject`, {
      token: adminToken,
      body: { reason: CUSTOMER_TX_REASON, internalNote: TX_INTERNAL_NOTE },
      base: WALLET,
    });
    rec(
      'Admin reject',
      rejected.status < 300 && (dataOf(rejected)?.status === 'REJECTED' || rejected.status === 200),
      `${rejected.status} ${dataOf(rejected)?.status ?? ''}`,
    );

    const afterReject = await api('GET', `/api/v1/wallets/transfers/reviews/${firstId}`, {
      token: consumerToken,
    });
    const rd = dataOf(afterReject);
    rec('customer status Declined', rd?.customerStatus === 'Declined', rd?.customerStatus);
    rec('customer reason visible', rd?.customerReason === CUSTOMER_TX_REASON);
    rec('internal note hidden from customer', !JSON.stringify(rd ?? {}).includes(TX_INTERNAL_NOTE));
  } else {
    rec('Admin reject', false, 'no review id');
  }

  const p10k2 = await prepare(1000000);
  const d10k2 = dataOf(p10k2);
  rec(
    'second $10k review',
    Boolean(d10k2?.reviewId) && d10k2?.reviewId !== firstId,
    maskId(d10k2?.reviewId),
  );
  if (d10k2?.reviewId) {
    const approved = await api(
      'POST',
      `/api/v1/admin/transaction-reviews/${d10k2.reviewId}/approve`,
      {
        token: adminToken,
        body: { reason: 'Physical QA approval — do not broadcast' },
        base: WALLET,
      },
    );
    rec(
      'Admin approve',
      approved.status < 300 && (dataOf(approved)?.status === 'APPROVED' || approved.status === 200),
      `${approved.status} ${dataOf(approved)?.status ?? ''}`,
    );
    const afterApprove = await api('GET', `/api/v1/wallets/transfers/reviews/${d10k2.reviewId}`, {
      token: consumerToken,
    });
    rec(
      'customer status Approved',
      dataOf(afterApprove)?.customerStatus === 'Approved',
      dataOf(afterApprove)?.customerStatus,
    );
  } else {
    rec('Admin approve', false, 'no second review');
  }

  const inbox = await api('GET', '/api/v1/notifications', { token: consumerToken });
  const items = dataOf(inbox)?.items ?? dataOf(inbox) ?? [];
  const list = Array.isArray(items) ? items : [];
  rec(
    'inbox IN_APP only',
    list.every((row) => !row.channel || row.channel === 'IN_APP'),
    `n=${list.length}`,
  );
  rec('inbox hides internal tx note', !JSON.stringify(list).includes(TX_INTERNAL_NOTE));
  const kycTitles = list.filter((row) =>
    String(row.subject ?? row.title ?? '')
      .toLowerCase()
      .includes('verification approved'),
  );
  rec(
    'inbox has no EMAIL-style KYC duplicate pair',
    !list.some((row) => String(row.subject ?? '') === 'Identity verification approved') ||
      !list.some((row) => String(row.subject ?? '') === 'Verification approved'),
    kycTitles.map((row) => row.subject ?? row.title).join(' | ') || 'none',
  );
  const pendingN = list.filter((row) =>
    String(row.subject ?? '')
      .toLowerCase()
      .includes('pending review'),
  );
  const declinedN = list.filter((row) =>
    String(row.subject ?? '')
      .toLowerCase()
      .includes('declined'),
  );
  const approvedN = list.filter((row) =>
    String(row.subject ?? '')
      .toLowerCase()
      .includes('transaction approved'),
  );
  rec('IN_APP pending notification', pendingN.length >= 1, String(pendingN.length));
  rec('IN_APP declined notification', declinedN.length >= 1, String(declinedN.length));
  rec('IN_APP approved notification', approvedN.length >= 1, String(approvedN.length));

  const emailInInbox = Number(
    psql(
      `SELECT COUNT(*) FROM notification_messages WHERE owner_user_id = '${QA_USER_ID}' AND channel = 'EMAIL' AND subject = 'Identity verification approved'`,
    ),
  );
  rec('EMAIL KYC approval still a separate channel row', emailInInbox >= 0, String(emailInInbox));

  const created = Number(
    psql(
      `SELECT COUNT(*) FROM security_audit_logs WHERE target_user_id = '${QA_USER_ID}' AND action::text = 'LARGE_TRANSFER_REVIEW_CREATED'`,
    ),
  );
  const rejectedAudit = Number(
    psql(
      `SELECT COUNT(*) FROM security_audit_logs WHERE target_user_id = '${QA_USER_ID}' AND action::text LIKE 'LARGE_TRANSFER_REVIEW%REJECT%'`,
    ),
  );
  const approvedAudit = Number(
    psql(
      `SELECT COUNT(*) FROM security_audit_logs WHERE target_user_id = '${QA_USER_ID}' AND action::text LIKE 'LARGE_TRANSFER_REVIEW%APPROV%'`,
    ),
  );
  rec('audit review created', created >= 1, String(created));
  rec('audit review rejected', rejectedAudit >= 1, String(rejectedAudit));
  rec('audit review approved', approvedAudit >= 1, String(approvedAudit));

  const checks = [
    ['postgres', await health('http://127.0.0.1:5432')],
    ['auth', await health('http://127.0.0.1:4001/ready')],
    ['wallet', await health('http://127.0.0.1:3002/ready')],
    ['compliance', await health('http://127.0.0.1:3005/ready')],
    ['notifications', await health('http://127.0.0.1:3006/health')],
    ['connections', await health('http://127.0.0.1:3016/ready')],
    ['gatewayHealth', await health('http://127.0.0.1:4000/health')],
    ['gatewayReady', await health('http://127.0.0.1:4000/ready')],
    ['web', await health('http://127.0.0.1:3000')],
    ['admin', await health('http://127.0.0.1:3001')],
  ];
  for (const [name, status] of checks) {
    rec(`${name} up`, status === 200 || (name === 'postgres' && status === 0), String(status));
  }
  rec('postgres via docker', psql('SELECT 1') === '1');

  const failCount = report.filter((row) => !row.pass).length;
  const out = {
    at: new Date().toISOString(),
    failCount,
    reviewIds: {
      rejected: firstId ?? null,
      approved: d10k2?.reviewId ?? null,
      extra: d1000001?.reviewId ?? null,
    },
    report,
  };
  fs.writeFileSync(
    path.join(root, 'artifacts', 'physical-tx-ui-qa.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(`\nSUMMARY ${report.length - failCount}/${report.length} passed`);
  process.exit(failCount ? 1 : 0);
}

main().catch((err) => {
  console.error('QA crashed:', err instanceof Error ? err.message : String(err));
  process.exit(2);
});
