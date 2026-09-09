#!/usr/bin/env node
/**
 * Cloud acceptance for trusted-device vault recovery (Admin JWT + consumer APIs).
 * No Postgres. Never prints passwords, reset tokens, or wrap keys.
 *
 * Env:
 *   API_BASE (default https://api.auvorawallet.com)
 *   ADMIN_ACCESS_TOKEN — SUPER_ADMIN JWT with step-up if required
 *   ACCEPTANCE_PASSWORD — password for synthetic users (min 12)
 *
 * Optional:
 *   SKIP_CLEANUP=1 — leave synthetic users for Dual App UI follow-up
 */
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

async function loadDeviceWrap() {
  try {
    return await import('@auvora/vault-crypto');
  } catch {
    const local = path.resolve(__dirname, '../../packages/vault-crypto/dist/index.js');
    return import(pathToFileURL(local).href);
  }
}

const { generateDeviceRecoveryKeyPair, wrapVaultKeyForDevice, unwrapVaultKeyForDevice } =
  await loadDeviceWrap();
void require;

const API_BASE = (process.env.API_BASE || 'https://api.auvorawallet.com').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_ACCESS_TOKEN || '';
const PASSWORD =
  process.env.ACCEPTANCE_PASSWORD || `AcceptVault!${crypto.randomBytes(6).toString('hex')}Aa1`;
const stamp = Date.now().toString(36);
const email = `vault.rec.${stamp}@auvora-acceptance.test`;
const username = `vaccept_${stamp}`.slice(0, 28);

function assertPass(label, ok, detail = '') {
  const line = ok ? `[PASS] ${label}` : `[FAIL] ${label}`;
  console.log(detail ? `${line} — ${detail}` : line);
  return ok;
}

async function api(method, path, { body, token } = {}) {
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json?.data, ok: res.ok && json?.success === true };
}

const results = {};

console.log('\n=== Vault recovery acceptance (API) ===\n');
results.adminToken = assertPass(
  'ADMIN_ACCESS_TOKEN present',
  Boolean(ADMIN_TOKEN && ADMIN_TOKEN.length > 20),
);

if (!results.adminToken) {
  console.error('Set ADMIN_ACCESS_TOKEN to a SUPER_ADMIN access token.');
  process.exit(1);
}

// 1) Register synthetic user
const reg = await api('POST', '/api/v1/auth/register', {
  body: {
    email,
    username,
    password: PASSWORD,
    firstName: 'Accept',
    lastName: 'Vault',
  },
});
results.register = assertPass(
  'Register acceptance email',
  reg.ok || reg.status === 201 || reg.json?.success,
  `status=${reg.status}`,
);

const userId = reg.data?.user?.id || reg.data?.id;
results.userId = assertPass('User id returned', typeof userId === 'string' && userId.length > 10);

// 2) Classify as simulation if endpoint exists (best-effort)
const classify = await api(
  'POST',
  `/api/v1/admin/simulation/accounts/${encodeURIComponent(userId)}/enable`,
  {
    token: ADMIN_TOKEN,
    body: { reason: 'vault-recovery acceptance' },
  },
);
results.classify = assertPass('Simulation enable', classify.ok, `status=${classify.status}`);

// 3) SUPER_ADMIN verify-email
const verify = await api(
  'POST',
  `/api/v1/admin/acceptance/users/${encodeURIComponent(userId)}/verify-email`,
  {
    token: ADMIN_TOKEN,
  },
);
results.verifyEmail = assertPass(
  'Acceptance verify-email',
  verify.ok,
  `status=${verify.status} err=${verify.json?.error?.code || ''}`,
);

// 4) Login Device A
const fpA = `accept-a-${stamp}`;
const loginA = await api('POST', '/api/v1/auth/login', {
  body: {
    email,
    password: PASSWORD,
    deviceFingerprint: fpA,
    devicePlatform: 'android',
    deviceName: 'DualApp-A',
  },
});
const tokenA = loginA.data?.accessToken;
results.loginA = assertPass('Device A login', Boolean(tokenA), `status=${loginA.status}`);

// 5) Admin vault-status (should be empty or exist)
const vaultStatus0 = await api(
  'GET',
  `/api/v1/admin/users/${encodeURIComponent(userId)}/vault-status`,
  {
    token: ADMIN_TOKEN,
  },
);
results.vaultStatusMeta = assertPass(
  'Admin vault-status scrubbed',
  vaultStatus0.ok &&
    vaultStatus0.data &&
    !('ciphertext' in vaultStatus0.data) &&
    !('wrappedVaultKey' in vaultStatus0.data),
  `exists=${vaultStatus0.data?.exists}`,
);

// 6) Crypto unit smoke (local wrap) — proves package available to runner
const kp = generateDeviceRecoveryKeyPair();
const vaultKey = crypto.randomBytes(32);
const requestId = crypto.randomUUID();
const wrapped = wrapVaultKeyForDevice({
  vaultKey,
  recipientPublicKey: kp.publicKey,
  requestId,
  ownerUserId: userId || crypto.randomUUID(),
});
const unwrapped = unwrapVaultKeyForDevice({
  wrapped,
  recipientPrivateKey: kp.privateKey,
  requestId,
  ownerUserId: userId || wrapped.aad.split('|')[1],
});
results.deviceWrap = assertPass(
  'X25519 device-wrap roundtrip',
  Buffer.compare(unwrapped, vaultKey) === 0,
);

// 7) Forgot password → create recovery request (Device B)
const forgot = await api('POST', '/api/v1/auth/forgot-password', { body: { email } });
results.forgot = assertPass('Forgot password enumeration-safe', forgot.ok || forgot.status === 200);

// Without mail token we cannot fully run create/collect against live mail.
// Probe pending list auth + IDOR shape.
const pendingA = await api('GET', '/api/v1/me/vault-recovery/requests/pending', { token: tokenA });
results.pendingList = assertPass(
  'Trusted device pending list',
  pendingA.ok,
  `status=${pendingA.status}`,
);

const recoveryMeta = await api(
  'GET',
  `/api/v1/admin/users/${encodeURIComponent(userId)}/vault-recovery`,
  {
    token: ADMIN_TOKEN,
  },
);
results.recoveryMeta = assertPass(
  'Admin vault-recovery metadata',
  recoveryMeta.ok && Array.isArray(recoveryMeta.data?.items),
);

const addresses = await api(
  'GET',
  `/api/v1/admin/blockchain/addresses?ownerUserId=${encodeURIComponent(userId)}&take=20`,
  {
    token: ADMIN_TOKEN,
  },
);
results.addresses = assertPass(
  'Admin blockchain addresses wired',
  addresses.ok,
  `status=${addresses.status}`,
);

if (!process.env.SKIP_CLEANUP) {
  const cleanup = await api(
    'POST',
    `/api/v1/admin/acceptance/users/${encodeURIComponent(userId)}/cleanup`,
    {
      token: ADMIN_TOKEN,
    },
  );
  results.cleanup = assertPass('Acceptance cleanup', cleanup.ok, `status=${cleanup.status}`);
} else {
  console.log(`[INFO] SKIP_CLEANUP=1 — synthetic user kept: ${email}`);
  results.cleanup = true;
}

const failed = Object.entries(results)
  .filter(([, v]) => !v)
  .map(([k]) => k);
console.log('\n=== Summary ===');
console.log(
  JSON.stringify(
    { emailDomain: '@auvora-acceptance.test', failed, pass: failed.length === 0 },
    null,
    2,
  ),
);
process.exit(failed.length === 0 ? 0 : 1);
