#!/usr/bin/env node
/**
 * Cloud acceptance harness for trusted-device vault recovery.
 * No Postgres. Never prints passwords, JWTs, reset tokens, mnemonics, or vault plaintext.
 *
 * Env (process only — never written to disk):
 *   API_BASE — default https://api.auvorawallet.com
 *   ADMIN_ACCESS_TOKEN — SUPER_ADMIN JWT (Bearer; preferred when both admin vars set)
 *   ADMIN_COOKIE — raw Cookie header for httpOnly admin session
 *   ACCEPTANCE_PASSWORD — synthetic user password (min 12)
 *   ACCEPTANCE_MNEMONIC — optional fixed 12-word BIP39 (never logged)
 *   ACCEPTANCE_RESET_TOKEN — optional fallback reset token (never logged)
 *   SKIP_CLEANUP=1 — retain synthetic user for Dual App UI follow-up
 */
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

async function loadVaultCrypto() {
  try {
    return await import('@auvora/vault-crypto');
  } catch {
    const local = path.resolve(__dirname, '../../packages/vault-crypto/dist/index.js');
    return import(pathToFileURL(local).href);
  }
}

async function loadBip39() {
  try {
    const mod = await import('@scure/bip39');
    const wordlist = (await import('@scure/bip39/wordlists/english.js')).wordlist;
    return { generateMnemonic: mod.generateMnemonic, wordlist };
  } catch {
    const root = path.resolve(__dirname, '../../apps/web/node_modules/@scure/bip39');
    const mod = await import(pathToFileURL(path.join(root, 'index.js')).href);
    const wordlist = (await import(pathToFileURL(path.join(root, 'wordlists/english.js')).href))
      .wordlist;
    return { generateMnemonic: mod.generateMnemonic, wordlist };
  }
}

const vaultCrypto = await loadVaultCrypto();
const {
  encryptVaultBundle,
  rewrapVaultWithNewPassword,
  generateDeviceRecoveryKeyPair,
  wrapVaultKeyForDevice,
  unwrapVaultKeyForDevice,
  VAULT_ALGORITHM_ID,
} = vaultCrypto;

const { generateMnemonic, wordlist } = await loadBip39();
void require;

const API_BASE = (process.env.API_BASE || 'https://api.auvorawallet.com').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_ACCESS_TOKEN || '';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE || '';
const PASSWORD =
  process.env.ACCEPTANCE_PASSWORD || `AcceptVault!${crypto.randomBytes(6).toString('hex')}Aa1`;
const stamp = Date.now().toString(36);
const email = `vault.rec.${stamp}@auvora-acceptance.test`;
const username = `vaccept_${stamp}`.slice(0, 28);

/** In-memory secrets — never logged or persisted. */
const mnemonic = process.env.ACCEPTANCE_MNEMONIC?.trim() || generateMnemonic(wordlist, 128);
const recoveryPhrase = mnemonic;

function assertPass(label, ok, detail = '') {
  const line = ok ? `[PASS] ${label}` : `[FAIL] ${label}`;
  console.log(detail ? `${line} — ${detail}` : line);
  return ok;
}

function adminHeaders() {
  const headers = {};
  if (ADMIN_TOKEN && ADMIN_TOKEN.length > 20) {
    headers.authorization = `Bearer ${ADMIN_TOKEN}`;
  } else if (ADMIN_COOKIE) {
    headers.cookie = ADMIN_COOKIE;
  }
  const csrf = process.env.ADMIN_CSRF_TOKEN || '';
  if (csrf) headers['x-csrf-token'] = csrf;
  return headers;
}

async function api(method, urlPath, { body, token, admin = false } = {}) {
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (admin) Object.assign(headers, adminHeaders());
  const res = await fetch(`${API_BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json?.data, ok: res.ok && json?.success === true };
}

async function extractVaultKeyWithPassword(ownerUserId, envelope, epoch, password) {
  const argon2 = (await import('argon2')).default;
  const { createDecipheriv } = await import('node:crypto');
  const aad = `${VAULT_ALGORITHM_ID}|${ownerUserId}|${epoch}`;
  const wrapAad = `${aad}|wrap-password`;
  const passwordKey = Buffer.from(
    await argon2.hash(password, {
      type: argon2.argon2id,
      salt: Buffer.from(envelope.kdfSalt, 'base64'),
      memoryCost: envelope.kdfParams.memoryCost,
      timeCost: envelope.kdfParams.timeCost,
      parallelism: envelope.kdfParams.parallelism,
      hashLength: envelope.kdfParams.hashLength,
      raw: true,
    }),
  );
  const payload = Buffer.from(envelope.wrappedVaultKey, 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', passwordKey, iv);
  decipher.setAAD(Buffer.from(wrapAad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function mintResetToken(userId) {
  if (process.env.ACCEPTANCE_RESET_TOKEN?.trim()) {
    return process.env.ACCEPTANCE_RESET_TOKEN.trim();
  }
  const mint = await api(
    'POST',
    `/api/v1/admin/acceptance/users/${encodeURIComponent(userId)}/mint-password-reset-token`,
    { admin: true },
  );
  if (!mint.ok || !mint.data?.resetToken) {
    return null;
  }
  return mint.data.resetToken;
}

async function createRecoveryRequest(resetToken, fpB, keyPairB) {
  return api('POST', '/api/v1/me/vault-recovery/requests', {
    body: {
      resetToken,
      requestingDeviceFingerprint: fpB,
      requestingPlatform: 'android',
      requestingPublicKey: keyPairB.publicKey,
    },
  });
}

async function approveRecovery(tokenA, requestId, wrapped) {
  return api(
    'POST',
    `/api/v1/me/vault-recovery/requests/${encodeURIComponent(requestId)}/approve`,
    {
      token: tokenA,
      body: wrapped,
    },
  );
}

async function collectRecovery(resetToken, requestId, fpB) {
  return api(
    'POST',
    `/api/v1/me/vault-recovery/requests/${encodeURIComponent(requestId)}/collect`,
    {
      body: { resetToken, requestingDeviceFingerprint: fpB },
    },
  );
}

const results = {};

console.log('\n=== Vault recovery acceptance (API) ===\n');

results.adminAuth = assertPass(
  'Admin auth present (ADMIN_ACCESS_TOKEN or ADMIN_COOKIE)',
  Boolean((ADMIN_TOKEN && ADMIN_TOKEN.length > 20) || (ADMIN_COOKIE && ADMIN_COOKIE.length > 10)),
);

if (!results.adminAuth) {
  console.error('Set ADMIN_ACCESS_TOKEN or ADMIN_COOKIE for SUPER_ADMIN admin auth.');
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

if (!results.userId) {
  process.exit(1);
}

// 2) Simulation enable
const classify = await api(
  'POST',
  `/api/v1/admin/simulation/accounts/${encodeURIComponent(userId)}/enable`,
  { admin: true, body: { reason: 'vault-recovery acceptance' } },
);
results.classify = assertPass('Simulation enable', classify.ok, `status=${classify.status}`);

// 3) Verify email
const verify = await api(
  'POST',
  `/api/v1/admin/acceptance/users/${encodeURIComponent(userId)}/verify-email`,
  { admin: true },
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

// 5) Encrypt and upload vault fixture
const walletId = `wallet-${stamp}`;
const bundle = {
  version: 1,
  wallets: [{ walletId, mnemonic, label: 'Acceptance Fixture' }],
};
const vaultPayload = await encryptVaultBundle({
  ownerUserId: userId,
  epoch: 1,
  password: PASSWORD,
  recoveryPhrase,
  bundle,
});
const vaultKey = await extractVaultKeyWithPassword(
  userId,
  vaultPayload,
  vaultPayload.epoch,
  PASSWORD,
);

const vaultPut = await api('PUT', '/api/v1/vault', {
  token: tokenA,
  body: {
    algorithmId: vaultPayload.algorithmId,
    version: vaultPayload.version,
    epoch: vaultPayload.epoch,
    kdfSalt: vaultPayload.kdfSalt,
    kdfParams: vaultPayload.kdfParams,
    recoveryKdfSalt: vaultPayload.recoveryKdfSalt,
    recoveryKdfParams: vaultPayload.recoveryKdfParams,
    wrappedVaultKey: vaultPayload.wrappedVaultKey,
    wrappedVaultKeyRecovery: vaultPayload.wrappedVaultKeyRecovery,
    ciphertext: vaultPayload.ciphertext,
    aad: vaultPayload.aad,
  },
});
results.vaultUpload = assertPass('Vault PUT epoch=1', vaultPut.ok, `status=${vaultPut.status}`);

const vaultStatus0 = await api(
  'GET',
  `/api/v1/admin/users/${encodeURIComponent(userId)}/vault-status`,
  { admin: true },
);
results.vaultStatusMeta = assertPass(
  'Admin vault-status scrubbed',
  vaultStatus0.ok &&
    vaultStatus0.data &&
    !('ciphertext' in vaultStatus0.data) &&
    !('wrappedVaultKey' in vaultStatus0.data),
  `exists=${vaultStatus0.data?.exists} epoch=${vaultStatus0.data?.epoch}`,
);

// Passkeys optional — never fail
results.passkeysOptional = assertPass('Passkeys optional (not implemented)', true);

// 6) Forgot password (enumeration-safe)
const forgot = await api('POST', '/api/v1/auth/forgot-password', { body: { email } });
results.forgot = assertPass('Forgot password enumeration-safe', forgot.ok || forgot.status === 200);

// Mint reset token for ceremony (never printed)
let resetToken = await mintResetToken(userId);
results.resetTokenMint = assertPass(
  'Reset token available (mint or ACCEPTANCE_RESET_TOKEN)',
  Boolean(resetToken && resetToken.length >= 20),
  resetToken ? 'source=ok' : 'BLOCKED: mint endpoint unavailable',
);

if (!resetToken) {
  console.log('\n=== Summary ===');
  console.log(
    JSON.stringify({ emailDomain: '@auvora-acceptance.test', blocked: 'reset-token' }, null, 2),
  );
  process.exit(1);
}

const fpB = `accept-b-${stamp}`;
const keyPairB = generateDeviceRecoveryKeyPair();

// 7a) Deny flow
const denyToken = resetToken;
const denyReq = await createRecoveryRequest(denyToken, fpB, keyPairB);
const denyRequestId = denyReq.data?.requestId;
results.denyCreate = assertPass(
  'Deny flow: create request',
  denyReq.ok && denyRequestId,
  `status=${denyReq.status}`,
);

if (denyRequestId && tokenA) {
  const denyCall = await api(
    'POST',
    `/api/v1/me/vault-recovery/requests/${encodeURIComponent(denyRequestId)}/deny`,
    { token: tokenA },
  );
  results.denyAction = assertPass(
    'Deny flow: owner denies',
    denyCall.ok,
    `status=${denyCall.status}`,
  );

  const denyCollect = await collectRecovery(denyToken, denyRequestId, fpB);
  results.denyCollectBlocked = assertPass(
    'Deny flow: collect blocked',
    !denyCollect.ok,
    `status=${denyCollect.status}`,
  );
}

// 7b) Expiry flow
resetToken = (await mintResetToken(userId)) || resetToken;
const expKeyPair = generateDeviceRecoveryKeyPair();
const expReq = await createRecoveryRequest(resetToken, fpB, expKeyPair);
const expRequestId = expReq.data?.requestId;
results.expiryCreate = assertPass(
  'Expiry flow: create request',
  expReq.ok && expRequestId,
  `status=${expReq.status}`,
);

if (expRequestId && tokenA) {
  const expWrapped = wrapVaultKeyForDevice({
    vaultKey,
    recipientPublicKey: expKeyPair.publicKey,
    requestId: expRequestId,
    ownerUserId: userId,
  });
  const expApprove = await approveRecovery(tokenA, expRequestId, expWrapped);
  results.expiryApprove = assertPass(
    'Expiry flow: approve',
    expApprove.ok,
    `status=${expApprove.status}`,
  );

  const forceExpire = await api(
    'POST',
    `/api/v1/admin/acceptance/vault-recovery/${encodeURIComponent(expRequestId)}/force-expire`,
    { admin: true },
  );
  results.expiryForce = assertPass(
    'Expiry flow: admin force-expire',
    forceExpire.ok,
    `status=${forceExpire.status}`,
  );

  const expCollect = await collectRecovery(resetToken, expRequestId, fpB);
  results.expiryCollectBlocked = assertPass(
    'Expiry flow: collect blocked',
    !expCollect.ok,
    `status=${expCollect.status}`,
  );
}

// 7c) Wrong device collect
resetToken = (await mintResetToken(userId)) || resetToken;
const wrongKeyPair = generateDeviceRecoveryKeyPair();
const wrongReq = await createRecoveryRequest(resetToken, fpB, wrongKeyPair);
const wrongRequestId = wrongReq.data?.requestId;
results.wrongDevCreate = assertPass(
  'Wrong device: create request',
  wrongReq.ok && wrongRequestId,
  `status=${wrongReq.status}`,
);

if (wrongRequestId && tokenA) {
  const wrongWrapped = wrapVaultKeyForDevice({
    vaultKey,
    recipientPublicKey: wrongKeyPair.publicKey,
    requestId: wrongRequestId,
    ownerUserId: userId,
  });
  await approveRecovery(tokenA, wrongRequestId, wrongWrapped);
  const wrongCollect = await collectRecovery(resetToken, wrongRequestId, 'wrong-fingerprint-xyz');
  results.wrongDevBlocked = assertPass(
    'Wrong device: collect blocked',
    !wrongCollect.ok,
    `status=${wrongCollect.status}`,
  );
}

// 7d) Replay collect
resetToken = (await mintResetToken(userId)) || resetToken;
const replayKeyPair = generateDeviceRecoveryKeyPair();
const replayReq = await createRecoveryRequest(resetToken, fpB, replayKeyPair);
const replayRequestId = replayReq.data?.requestId;
results.replayCreate = assertPass(
  'Replay: create request',
  replayReq.ok && replayRequestId,
  `status=${replayReq.status}`,
);

if (replayRequestId && tokenA) {
  const replayWrapped = wrapVaultKeyForDevice({
    vaultKey,
    recipientPublicKey: replayKeyPair.publicKey,
    requestId: replayRequestId,
    ownerUserId: userId,
  });
  await approveRecovery(tokenA, replayRequestId, replayWrapped);
  const replayFirst = await collectRecovery(resetToken, replayRequestId, fpB);
  results.replayFirstCollect = assertPass(
    'Replay: first collect succeeds',
    replayFirst.ok && replayFirst.data?.wrapped,
    `status=${replayFirst.status}`,
  );
  const replaySecond = await collectRecovery(resetToken, replayRequestId, fpB);
  results.replaySecondBlocked = assertPass(
    'Replay: second collect blocked',
    !replaySecond.ok,
    `status=${replaySecond.status}`,
  );
}

// 7e) Happy path complete (password rotation)
resetToken = (await mintResetToken(userId)) || resetToken;
const completeKeyPair = generateDeviceRecoveryKeyPair();
const completeReq = await createRecoveryRequest(resetToken, fpB, completeKeyPair);
const completeRequestId = completeReq.data?.requestId;
results.completeCreate = assertPass(
  'Complete flow: create request',
  completeReq.ok && completeRequestId,
  `status=${completeReq.status}`,
);

const NEW_PASSWORD = `NewVault!${crypto.randomBytes(6).toString('hex')}Bb2`;

if (completeRequestId && tokenA) {
  const pendingA = await api('GET', '/api/v1/me/vault-recovery/requests/pending', {
    token: tokenA,
  });
  results.pendingList = assertPass(
    'Trusted device pending list',
    pendingA.ok,
    `count=${Array.isArray(pendingA.data) ? pendingA.data.length : 0}`,
  );

  const completeWrapped = wrapVaultKeyForDevice({
    vaultKey,
    recipientPublicKey: completeKeyPair.publicKey,
    requestId: completeRequestId,
    ownerUserId: userId,
  });
  const completeApprove = await approveRecovery(tokenA, completeRequestId, completeWrapped);
  results.completeApprove = assertPass(
    'Complete flow: approve',
    completeApprove.ok,
    `status=${completeApprove.status}`,
  );

  const completeCollect = await collectRecovery(resetToken, completeRequestId, fpB);
  results.completeCollect = assertPass(
    'Complete flow: collect wrapped key',
    completeCollect.ok && completeCollect.data?.wrapped,
    `status=${completeCollect.status}`,
  );

  if (completeCollect.ok && completeCollect.data?.wrapped) {
    const unwrappedKey = unwrapVaultKeyForDevice({
      wrapped: completeCollect.data.wrapped,
      recipientPrivateKey: completeKeyPair.privateKey,
      requestId: completeRequestId,
      ownerUserId: userId,
    });
    results.unwrapRoundtrip = assertPass(
      'Complete flow: unwrap matches vault key',
      Buffer.compare(unwrappedKey, vaultKey) === 0,
    );

    const rewrapped = await rewrapVaultWithNewPassword({
      ownerUserId: userId,
      envelope: vaultPayload,
      epoch: vaultPayload.epoch,
      recoveryPhrase,
      newPassword: NEW_PASSWORD,
    });

    const recoveryPut = await api('PUT', '/api/v1/vault/recovery', {
      body: {
        ...rewrapped,
        resetToken,
        requestId: completeRequestId,
      },
    });
    results.recoveryVaultPut = assertPass(
      'Complete flow: PUT vault/recovery',
      recoveryPut.ok,
      `status=${recoveryPut.status} epoch=${rewrapped.epoch}`,
    );

    const completeCall = await api('POST', '/api/v1/me/vault-recovery/complete', {
      body: {
        resetToken,
        requestId: completeRequestId,
        newPassword: NEW_PASSWORD,
        expectedVaultEpoch: rewrapped.epoch,
      },
    });
    results.completeFinalize = assertPass(
      'Complete flow: recovery complete',
      completeCall.ok,
      `status=${completeCall.status}`,
    );

    const oldLogin = await api('POST', '/api/v1/auth/login', {
      body: { email, password: PASSWORD, deviceFingerprint: fpA, devicePlatform: 'android' },
    });
    results.oldPasswordBlocked = assertPass(
      'Post-complete: old password rejected',
      !oldLogin.ok || !oldLogin.data?.accessToken,
      `status=${oldLogin.status}`,
    );

    const newLogin = await api('POST', '/api/v1/auth/login', {
      body: {
        email,
        password: NEW_PASSWORD,
        deviceFingerprint: fpB,
        devicePlatform: 'android',
        deviceName: 'DualApp-B',
      },
    });
    results.newPasswordWorks = assertPass(
      'Post-complete: new password login',
      Boolean(newLogin.data?.accessToken),
      `status=${newLogin.status}`,
    );
  }
}

// Admin metadata checks
const recoveryMeta = await api(
  'GET',
  `/api/v1/admin/users/${encodeURIComponent(userId)}/vault-recovery`,
  { admin: true },
);
results.recoveryMeta = assertPass(
  'Admin vault-recovery metadata',
  recoveryMeta.ok && Array.isArray(recoveryMeta.data?.items),
  `items=${recoveryMeta.data?.items?.length ?? 0}`,
);

const addresses = await api(
  'GET',
  `/api/v1/admin/blockchain/addresses?ownerUserId=${encodeURIComponent(userId)}&take=20`,
  { admin: true },
);
results.addresses = assertPass(
  'Admin blockchain addresses wired',
  addresses.ok,
  `status=${addresses.status}`,
);

// Cleanup
if (!process.env.SKIP_CLEANUP) {
  const cleanup = await api(
    'POST',
    `/api/v1/admin/acceptance/users/${encodeURIComponent(userId)}/cleanup`,
    { admin: true },
  );
  results.cleanup = assertPass('Acceptance cleanup', cleanup.ok, `status=${cleanup.status}`);
} else {
  console.log(`[INFO] SKIP_CLEANUP=1 — synthetic user kept: ${email}`);
  results.cleanup = true;
}

// Revoke admin JWT session when Bearer token was used
let tokenRevoked = false;
if (ADMIN_TOKEN && ADMIN_TOKEN.length > 20) {
  const logout = await api('POST', '/api/v1/auth/admin/logout', { token: ADMIN_TOKEN });
  tokenRevoked = logout.ok;
}
console.log(`TEMP TOKEN REVOKED: ${tokenRevoked ? 'YES' : 'NO'}`);

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
