/**
 * LOCAL QA ONLY — KYC + $5k/$10k prepare policy on the canonical QA user.
 * Never prints tokens, passwords, mnemonics, or full addresses.
 * Does not sign or broadcast.
 */
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const QA_USER_ID = 'df1db712-5e50-42c1-92fc-2c7236244cf8';
const GATEWAY = 'http://127.0.0.1:4000';
const COMPLIANCE = 'http://127.0.0.1:3005';
const WALLET = 'http://127.0.0.1:3002';
const DEST = '0x0000000000000000000000000000000000000001';
const INTERNAL_NOTE = 'QA rejection workflow test';
const TX_INTERNAL_NOTE = 'QA transaction rejection test';
const CUSTOMER_KYC_REASON = 'Please submit a clearer identity document.';
const CUSTOMER_TX_REASON =
  'Additional review information is required before this transaction can be completed.';

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
    'compliance:write',
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
  permissions: [
    'compliance:admin',
    'compliance:review',
    'compliance:read',
    'transactions:review:large',
    'audit:read',
    'notification:admin',
  ],
  surface: 'admin',
  stepUpExp: Math.floor(Date.now() / 1000) + 3600,
});

const report = [];
function rec(name, pass, detail = '') {
  report.push({ name, pass, detail });
  const line = `${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
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

async function main() {
  rec('gateway health', (await health(`${GATEWAY}/health`)) === 200);
  rec('gateway ready', (await health(`${GATEWAY}/ready`)) === 200);

  const userRow = psql(
    `SELECT id || '|' || COALESCE(email,'') || '|' || COALESCE(username,'') FROM users WHERE id = '${QA_USER_ID}'`,
  );
  rec('canonical user', userRow.startsWith(QA_USER_ID), maskId(QA_USER_ID));

  const walletCount = Number(
    psql(
      `SELECT COUNT(*) FROM wallets WHERE owner_user_id = '${QA_USER_ID}' AND archived_at IS NULL`,
    ),
  );
  rec('wallet rows = 6', walletCount === 6, String(walletCount));
  const dupes = Number(
    psql(
      `SELECT COUNT(*) FROM (
         SELECT asset_id, COUNT(*) c FROM wallets
         WHERE owner_user_id = '${QA_USER_ID}' AND archived_at IS NULL
         GROUP BY asset_id HAVING COUNT(*) > 1
       ) d`,
    ),
  );
  rec('wallet duplicates none', dupes === 0, String(dupes));

  const kycProfiles = Number(
    psql(`SELECT COUNT(*) FROM kyc_profiles WHERE owner_user_id = '${QA_USER_ID}'`),
  );
  rec('kyc profile count before (0 or 1)', kycProfiles <= 1, String(kycProfiles));

  psql(`
    INSERT INTO asset_market_metadata (id, asset_id, network, symbol, name, decimals, contract_address, token_type, verification_status)
    SELECT gen_random_uuid(), a.id, a.chain, a.code, 'QA Ethereum', a.decimals, '', 'NATIVE', 'UNVERIFIED'
    FROM assets a
    WHERE a.code = 'ETH'
      AND NOT EXISTS (SELECT 1 FROM asset_market_metadata m WHERE m.asset_id = a.id)
  `);
  psql(`
    INSERT INTO price_quotes (id, metadata_id, quote_currency, price, source, as_of)
    SELECT gen_random_uuid(), m.id, 'USD', 1, 'qa-synthetic', NOW()
    FROM asset_market_metadata m
    JOIN assets a ON a.id = m.asset_id
    WHERE a.code = 'ETH'
      AND NOT EXISTS (
        SELECT 1 FROM price_quotes pq WHERE pq.metadata_id = m.id AND pq.quote_currency = 'USD'
      )
  `);
  psql(`
    UPDATE price_quotes pq SET as_of = NOW(), price = 1, source = 'qa-synthetic'
    FROM asset_market_metadata m
    JOIN assets a ON a.id = m.asset_id
    WHERE pq.metadata_id = m.id AND a.code = 'ETH' AND pq.quote_currency = 'USD'
  `);
  const ethPrice = psql(`
    SELECT COALESCE(pq.price::text,'') FROM price_quotes pq
    JOIN asset_market_metadata m ON m.id = pq.metadata_id
    JOIN assets a ON a.id = m.asset_id
    WHERE a.code = 'ETH' AND pq.quote_currency = 'USD'
    ORDER BY pq.as_of DESC LIMIT 1
  `);
  rec('ETH $1 QA quote', ethPrice.startsWith('1'), ethPrice);

  const submit = await api('POST', '/api/v1/compliance/kyc', {
    token: consumerToken,
    body: { requestedLevel: 'BASIC', legalName: 'QA User', country: 'US' },
  });
  const submitted = dataOf(submit);
  rec(
    'KYC submission IN_REVIEW',
    submit.status < 300 && submitted?.status === 'IN_REVIEW',
    `${submit.status} ${submitted?.status ?? ''}`,
  );
  rec(
    'KYC not auto-approved',
    submitted?.status !== 'APPROVED',
    String(submitted?.status ?? submit.status),
  );

  const queue = await api('GET', '/api/v1/admin/compliance/kyc/queue', {
    token: adminToken,
    base: COMPLIANCE,
  });
  const queueItems = dataOf(queue) ?? [];
  const inQueue = Array.isArray(queueItems)
    ? queueItems.filter((row) => row.ownerUserId === QA_USER_ID)
    : [];
  rec('Admin KYC queue has canonical user', inQueue.length >= 1, `n=${inQueue.length}`);
  const requestId = submitted?.id ?? inQueue[0]?.id;
  rec('KYC request id', Boolean(requestId), maskId(requestId));

  const snap1 = await api('GET', '/api/v1/compliance/kyc', { token: consumerToken });
  rec('customer snapshot In review', dataOf(snap1)?.status === 'IN_REVIEW', dataOf(snap1)?.status);

  if (requestId) {
    const rejected = await api('POST', `/api/v1/admin/compliance/kyc/${requestId}/reject`, {
      token: adminToken,
      body: { reason: CUSTOMER_KYC_REASON, internalNote: INTERNAL_NOTE },
      base: COMPLIANCE,
    });
    rec(
      'Admin KYC reject',
      rejected.status < 300 && dataOf(rejected)?.status === 'REJECTED',
      `${rejected.status} ${dataOf(rejected)?.status ?? ''}`,
    );
    rec('reject stores customer reason', dataOf(rejected)?.rejectionReason === CUSTOMER_KYC_REASON);
    const meta = dataOf(rejected)?.metadata ?? {};
    rec('internal note stored', meta.internalAdminNote === INTERNAL_NOTE);
  }

  const snap2 = await api('GET', '/api/v1/compliance/kyc', { token: consumerToken });
  const snap2d = dataOf(snap2);
  rec('customer KYC REJECTED', snap2d?.status === 'REJECTED', snap2d?.status);
  rec('customer sees rejection reason', snap2d?.rejectionReason === CUSTOMER_KYC_REASON);
  rec(
    'customer snapshot hides internal note',
    !JSON.stringify(snap2d ?? {}).includes(INTERNAL_NOTE),
  );

  const latest = await api('GET', '/api/v1/compliance/kyc/status', { token: consumerToken });
  rec(
    'GET kyc/status hides internal note',
    !JSON.stringify(dataOf(latest) ?? {}).includes(INTERNAL_NOTE),
  );

  async function prepare(amount, key = randomUUID()) {
    return api('POST', '/api/v1/wallets/transfers/prepare', {
      token: consumerToken,
      body: {
        assetCode: 'ETH',
        destinationAddress: DEST,
        amount,
        idempotencyKey: key,
        networkEnv: 'mainnet',
      },
    });
  }

  const p4999 = await prepare('4999.99');
  const d4999 = dataOf(p4999);
  rec(
    '$4,999.99 below threshold',
    p4999.status < 300 && d4999?.allowed === true && d4999?.status === 'below_threshold',
    `${p4999.status} ${d4999?.status} review=${d4999?.reviewId ?? 'none'}`,
  );

  const p5k = await prepare('5000.00');
  const d5k = dataOf(p5k);
  rec(
    '$5,000.00 KYC required (not approved)',
    p5k.status < 300 &&
      d5k?.allowed === false &&
      d5k?.status === 'kyc_required' &&
      !d5k?.reviewId &&
      d5k?.message === 'Identity verification required',
    `${p5k.status} ${d5k?.status} ${d5k?.message ?? ''}`,
  );

  const p10kNoKyc = await prepare('10000.00');
  const d10kNo = dataOf(p10kNoKyc);
  rec(
    '$10,000 KYC-first (not approved)',
    p10kNoKyc.status < 300 &&
      d10kNo?.status === 'kyc_required' &&
      !d10kNo?.reviewId &&
      d10kNo?.message === 'Identity verification required',
    `${p10kNoKyc.status} ${d10kNo?.status} review=${d10kNo?.reviewId ?? 'none'}`,
  );

  const resubmit = await api('POST', '/api/v1/compliance/kyc', {
    token: consumerToken,
    body: { requestedLevel: 'BASIC', legalName: 'QA User', country: 'US' },
  });
  rec(
    'KYC resubmission IN_REVIEW',
    resubmit.status < 300 && dataOf(resubmit)?.status === 'IN_REVIEW',
    `${resubmit.status} ${dataOf(resubmit)?.status ?? ''}`,
  );

  const queue2 = await api('GET', '/api/v1/admin/compliance/kyc/queue', {
    token: adminToken,
    base: COMPLIANCE,
  });
  const inQueue2 = (dataOf(queue2) ?? []).filter((row) => row.ownerUserId === QA_USER_ID);
  const resubmitId = dataOf(resubmit)?.id ?? inQueue2[0]?.id;
  if (resubmitId) {
    const approved = await api('POST', `/api/v1/admin/compliance/kyc/${resubmitId}/approve`, {
      token: adminToken,
      base: COMPLIANCE,
    });
    rec(
      'Admin KYC approve',
      approved.status < 300 && dataOf(approved)?.status === 'APPROVED',
      `${approved.status} ${dataOf(approved)?.status ?? ''}`,
    );
  } else {
    rec('Admin KYC approve', false, 'no resubmit request id');
  }

  const snap3 = await api('GET', '/api/v1/compliance/kyc', { token: consumerToken });
  rec(
    'customer KYC APPROVED/Verified',
    dataOf(snap3)?.status === 'APPROVED',
    dataOf(snap3)?.status,
  );

  const profilesAfter = Number(
    psql(`SELECT COUNT(*) FROM kyc_profiles WHERE owner_user_id = '${QA_USER_ID}'`),
  );
  rec('single KYC profile', profilesAfter === 1, String(profilesAfter));

  const p5kOk = await prepare('5000.00');
  rec(
    '$5,000.00 after KYC no Admin review',
    p5kOk.status < 300 &&
      dataOf(p5kOk)?.allowed === true &&
      dataOf(p5kOk)?.status === 'kyc_satisfied' &&
      !dataOf(p5kOk)?.reviewId,
    `${p5kOk.status} ${dataOf(p5kOk)?.status}`,
  );

  const p9999 = await prepare('9999.99');
  rec(
    '$9,999.99 KYC gate only',
    p9999.status < 300 &&
      dataOf(p9999)?.allowed === true &&
      dataOf(p9999)?.status === 'kyc_satisfied' &&
      !dataOf(p9999)?.reviewId,
    `${p9999.status} ${dataOf(p9999)?.status}`,
  );

  const p10k = await prepare('10000.00');
  const d10k = dataOf(p10k);
  rec(
    '$10,000.00 Admin review persisted',
    p10k.status < 300 &&
      d10k?.allowed === false &&
      d10k?.status === 'review_required' &&
      Boolean(d10k?.reviewId) &&
      d10k?.reviewStatus === 'PENDING',
    `${p10k.status} ${d10k?.status} ${d10k?.reviewStatus} ${d10k?.message ?? ''}`,
  );
  rec(
    'customer pending language',
    String(d10k?.message ?? '')
      .toLowerCase()
      .includes('pending review'),
    d10k?.message,
  );

  const p1000001 = await prepare('10000.01');
  rec(
    '$10,000.01 Admin review',
    p1000001.status < 300 &&
      dataOf(p1000001)?.status === 'review_required' &&
      Boolean(dataOf(p1000001)?.reviewId),
    `${p1000001.status} ${dataOf(p1000001)?.status}`,
  );

  const pendingReviews = await api(
    'GET',
    `/api/v1/admin/transaction-reviews?status=PENDING&ownerUserId=${QA_USER_ID}`,
    { token: adminToken, base: WALLET },
  );
  const pendingItems = dataOf(pendingReviews)?.items ?? dataOf(pendingReviews) ?? [];
  const pendingList = Array.isArray(pendingItems) ? pendingItems : [];
  rec('Admin pending reviews >= 1', pendingList.length >= 1, `n=${pendingList.length}`);

  const firstReviewId = d10k?.reviewId;
  if (firstReviewId) {
    const txReject = await api(
      'POST',
      `/api/v1/admin/transaction-reviews/${firstReviewId}/reject`,
      {
        token: adminToken,
        body: { reason: CUSTOMER_TX_REASON, internalNote: TX_INTERNAL_NOTE },
        base: WALLET,
      },
    );
    rec(
      'Admin $10k reject',
      txReject.status < 300 && (dataOf(txReject)?.status === 'REJECTED' || txReject.status === 200),
      `${txReject.status} ${dataOf(txReject)?.status ?? JSON.stringify(txReject.json).slice(0, 120)}`,
    );
  } else {
    rec('Admin $10k reject', false, 'no review id');
  }

  const replayReject = firstReviewId
    ? await prepare('10000.00', /* same key as p10k */ undefined)
    : { status: 0, json: {} };
  void replayReject;

  const p10kApprove = await prepare('10000.00');
  const d10kA = dataOf(p10kApprove);
  rec(
    'second $10k review created',
    Boolean(d10kA?.reviewId) && d10kA?.reviewId !== firstReviewId,
    maskId(d10kA?.reviewId),
  );
  if (d10kA?.reviewId) {
    const txApprove = await api(
      'POST',
      `/api/v1/admin/transaction-reviews/${d10kA.reviewId}/approve`,
      {
        token: adminToken,
        body: { reason: 'QA transaction approval test — do not broadcast' },
        base: WALLET,
      },
    );
    rec(
      'Admin $10k approve',
      txApprove.status < 300,
      `${txApprove.status} ${dataOf(txApprove)?.status ?? JSON.stringify(txApprove.json).slice(0, 120)}`,
    );
  } else {
    rec('Admin $10k approve', false, 'no second review id');
  }

  const inbox = await api('GET', '/api/v1/notifications', { token: consumerToken });
  const inboxItems = dataOf(inbox)?.items ?? dataOf(inbox) ?? [];
  const list = Array.isArray(inboxItems) ? inboxItems : [];
  rec('in-app notifications present', list.length > 0, `n=${list.length}`);
  const blob = JSON.stringify(list);
  rec('inbox hides internal KYC note', !blob.includes(INTERNAL_NOTE));
  rec('inbox hides internal tx note', !blob.includes(TX_INTERNAL_NOTE));

  const emailSql = psql(`
    SELECT string_agg(channel || ':' || status || ':' || COALESCE(subject,''), ' || ')
    FROM (
      SELECT channel::text, status::text, subject
      FROM notification_messages
      WHERE owner_user_id = '${QA_USER_ID}'
      ORDER BY created_at DESC
      LIMIT 20
    ) t
  `);
  rec('notification messages exist', Boolean(emailSql), emailSql.slice(0, 240));
  const leakCount = Number(
    psql(`
      SELECT COUNT(*) FROM notification_messages
      WHERE owner_user_id = '${QA_USER_ID}'
        AND (body ILIKE '%QA rejection workflow test%' OR body ILIKE '%QA transaction rejection test%')
    `),
  );
  rec('notification bodies omit internal notes', leakCount === 0, String(leakCount));

  const emailChannels = psql(`
    SELECT COUNT(*) FROM notification_messages
    WHERE owner_user_id = '${QA_USER_ID}' AND channel = 'EMAIL'
  `);
  const deliveredEmail = Number(
    psql(`
      SELECT COUNT(*) FROM notification_messages
      WHERE owner_user_id = '${QA_USER_ID}' AND channel = 'EMAIL' AND status = 'DELIVERED'
    `),
  );
  const queuedEmail = Number(
    psql(`
      SELECT COUNT(*) FROM notification_messages
      WHERE owner_user_id = '${QA_USER_ID}' AND channel = 'EMAIL'
        AND status IN ('PENDING','QUEUED','SENT')
    `),
  );
  rec(
    'email events created',
    Number(emailChannels) > 0,
    `total=${emailChannels} delivered=${deliveredEmail} queuedish=${queuedEmail}`,
  );

  const auditKyc = Number(
    psql(`
      SELECT COUNT(*) FROM security_audit_logs
      WHERE target_user_id = '${QA_USER_ID}'
        AND action::text LIKE 'LARGE_TRANSFER_REVIEW%'
    `),
  );
  rec('transaction audit logs', auditKyc >= 1, String(auditKyc));

  const failCount = report.filter((r) => !r.pass).length;
  console.log(`\nSUMMARY ${report.length - failCount}/${report.length} passed`);
  fs.writeFileSync(
    path.join(root, 'artifacts', 'kyc-policy-qa-results.json'),
    JSON.stringify({ at: new Date().toISOString(), failCount, report }, null, 2),
  );
  process.exit(failCount ? 1 : 0);
}

main().catch((err) => {
  console.error('E2E crashed:', err instanceof Error ? err.message : String(err));
  process.exit(2);
});
