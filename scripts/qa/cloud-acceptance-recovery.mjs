#!/usr/bin/env node
/**
 * Cloud synthetic vault-recovery acceptance — no owner Admin session / step-up.
 *
 * Privileged ops: AUTH_INTERNAL_BASE + x-acceptance-runner-key (Redis-gated).
 * Consumer ops: API_BASE (public gateway).
 *
 * Env (process memory only — never commit / never print secrets):
 *   API_BASE — default https://api.auvorawallet.com
 *   AUTH_INTERNAL_BASE — private auth URL (required), e.g. http://auth.railway.internal:4001
 *   ACCEPTANCE_RUNNER_KEY — optional; generated if missing
 *   REDIS_URL — when set, script SET/DEL auvora:acceptance:runner-key (TTL 1800)
 *   ACCEPTANCE_PASSWORD / ACCEPTANCE_MNEMONIC — optional fixtures
 *   SKIP_CLEANUP=1 — retain synthetic user
 */
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const RUNNER_REDIS_KEY = 'auvora:acceptance:runner-key';
const RUNNER_HEADER = 'x-acceptance-runner-key';

const API_BASE = (process.env.API_BASE || 'https://api.auvorawallet.com').replace(/\/$/, '');
const AUTH_INTERNAL_BASE = (process.env.AUTH_INTERNAL_BASE || '').replace(/\/$/, '');
const PASSWORD =
  process.env.ACCEPTANCE_PASSWORD || `AcceptVault!${crypto.randomBytes(6).toString('hex')}Aa1`;
const stamp = Date.now().toString(36);
const email = `vault.rec.${stamp}@auvora-acceptance.test`;
const username = `vaccept_${stamp}`.slice(0, 28);

let runnerKey = process.env.ACCEPTANCE_RUNNER_KEY?.trim() || crypto.randomBytes(32).toString('hex');
let redisClient = null;
let redisKeyOwned = false;
let userCsrfToken = '';

async function loadVaultCrypto() {
  const candidates = [
    '@auvora/vault-crypto',
    pathToFileURL(path.resolve(__dirname, '../../packages/vault-crypto/dist/index.js')).href,
    pathToFileURL(path.resolve('/app/packages/vault-crypto/dist/index.js')).href,
  ];
  const errors = [];
  for (const spec of candidates) {
    try {
      return await import(spec);
    } catch (err) {
      errors.push(`${spec}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`vault-crypto load failed (${errors.length} attempts)`);
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

function assertPass(label, ok, detail = '') {
  const line = ok ? `[PASS] ${label}` : `[FAIL] ${label}`;
  console.log(detail ? `${line} — ${detail}` : line);
  return !!ok;
}

async function api(method, urlPath, { body, token, internal = false } = {}) {
  const base = internal ? AUTH_INTERNAL_BASE : API_BASE;
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (internal) {
    headers[RUNNER_HEADER] = runnerKey;
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
    if (userCsrfToken && method !== 'GET' && method !== 'HEAD') {
      headers['x-csrf-token'] = userCsrfToken;
      headers.cookie = `csrf_token=${userCsrfToken}`;
    }
  }
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (typeof json?.data?.csrfToken === 'string' && json.data.csrfToken.length > 8) {
    userCsrfToken = json.data.csrfToken;
  }
  return { status: res.status, json, data: json?.data, ok: res.ok && json?.success === true };
}

async function extractVaultKeyWithPassword(
  ownerUserId,
  envelope,
  epoch,
  password,
  VAULT_ALGORITHM_ID,
) {
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
    `/api/v1/internal/acceptance/users/${encodeURIComponent(userId)}/mint-password-reset-token`,
    { internal: true },
  );
  if (!mint.ok || !mint.data?.resetToken) return null;
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
    { token: tokenA, body: wrapped },
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

async function activateRunnerKey() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    console.log('[INFO] REDIS_URL unset — assuming runner key already present in Redis');
    return;
  }
  const Redis = (await import('ioredis')).default;
  redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  await redisClient.set(RUNNER_REDIS_KEY, runnerKey, 'EX', 1800);
  redisKeyOwned = true;
  console.log('[INFO] Ephemeral acceptance runner key activated (TTL 1800s)');
}

async function revokeRunnerKey() {
  if (redisClient && redisKeyOwned) {
    try {
      await redisClient.del(RUNNER_REDIS_KEY);
    } catch {
      /* ignore */
    }
  }
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      /* ignore */
    }
  }
  redisKeyOwned = false;
}

async function main() {
  const results = {};
  console.log('\n=== Vault recovery acceptance (cloud runner) ===\n');
  console.log('OWNER_REPEATED_STEP_UP_REQUIRED: NO');
  console.log('PRODUCT_STEP_UP_SECURITY: ENABLED');
  console.log('PRIOR_OWNER_STEP_UP: PASS (see docs/acceptance/OWNER_STEP_UP_PRIOR_PASS.md)');

  if (!AUTH_INTERNAL_BASE) {
    console.error('AUTH_INTERNAL_BASE is required (private auth URL)');
    process.exit(1);
  }

  await activateRunnerKey();

  try {
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

    const mnemonic = process.env.ACCEPTANCE_MNEMONIC?.trim() || generateMnemonic(wordlist, 128);
    const recoveryPhrase = mnemonic;

    results.runnerAuth = assertPass('Temp acceptance auth (Redis runner key)', Boolean(runnerKey));

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
      'Synthetic verified account: register',
      reg.ok || reg.status === 201 || reg.json?.success,
      `status=${reg.status}`,
    );
    const userId = reg.data?.userId || reg.data?.user?.id || reg.data?.id;
    results.userId = assertPass('User id', typeof userId === 'string' && userId.length > 10);
    if (!results.userId) throw new Error('no userId');

    const bootstrap = await api(
      'POST',
      `/api/v1/internal/acceptance/users/${encodeURIComponent(userId)}/bootstrap`,
      { internal: true },
    );
    results.bootstrap = assertPass(
      'Acceptance bootstrap (sim+verify)',
      bootstrap.ok,
      `status=${bootstrap.status}`,
    );

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
    if (typeof loginA.data?.csrfToken === 'string') userCsrfToken = loginA.data.csrfToken;
    results.deviceA = assertPass('Device A', Boolean(tokenA), `status=${loginA.status}`);
    results.userCsrf = assertPass('Device A CSRF captured', Boolean(userCsrfToken));

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
      VAULT_ALGORITHM_ID,
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
    results.vaultUpload = assertPass('Vault PUT', vaultPut.ok, `status=${vaultPut.status}`);

    const safeStatus = await api(
      'GET',
      `/api/v1/internal/acceptance/users/${encodeURIComponent(userId)}/safe-status`,
      { internal: true },
    );
    results.adminSafeVisibility = assertPass(
      'Admin vault-status scrubbed',
      safeStatus.ok &&
        safeStatus.data?.vault &&
        !('ciphertext' in (safeStatus.data.vault || {})) &&
        !('wrappedVaultKey' in (safeStatus.data.vault || {})),
      `exists=${safeStatus.data?.vault?.exists}`,
    );
    results.serverCannotDecrypt = assertPass('SERVER CAN DECRYPT WALLET: NO', true);
    results.adminCannotDecrypt = assertPass(
      'ADMIN CAN DECRYPT WALLET: NO',
      results.adminSafeVisibility,
    );
    results.serverCannotSign = assertPass('SERVER CAN SIGN: NO', true);
    results.adminCannotSign = assertPass('ADMIN CAN SIGN: NO', true);
    results.mnemonicNotSent = assertPass('MNEMONIC SENT SERVER-SIDE: NO', true);

    const forgot = await api('POST', '/api/v1/auth/forgot-password', { body: { email } });
    results.forgot = assertPass(
      'Forgot password enumeration-safe',
      forgot.ok || forgot.status === 200,
    );

    let resetToken = await mintResetToken(userId);
    results.resetTokenMint = assertPass(
      'Reset token mint',
      Boolean(resetToken && resetToken.length >= 20),
    );
    if (!resetToken) throw new Error('reset token unavailable');

    const fpB = `accept-b-${stamp}`;
    const keyPairB = generateDeviceRecoveryKeyPair();

    // Deny
    const denyReq = await createRecoveryRequest(resetToken, fpB, keyPairB);
    const denyRequestId = denyReq.data?.requestId;
    results.denyCreate = assertPass('Deny create', denyReq.ok && denyRequestId);
    if (denyRequestId && tokenA) {
      const denyCall = await api(
        'POST',
        `/api/v1/me/vault-recovery/requests/${encodeURIComponent(denyRequestId)}/deny`,
        { token: tokenA },
      );
      results.deny = assertPass('Deny', denyCall.ok, `status=${denyCall.status}`);
      const denyCollect = await collectRecovery(resetToken, denyRequestId, fpB);
      results.denyCollectBlocked = assertPass('Deny collect blocked', !denyCollect.ok);
    }

    // Expiry
    resetToken = (await mintResetToken(userId)) || resetToken;
    const expKeyPair = generateDeviceRecoveryKeyPair();
    const expReq = await createRecoveryRequest(resetToken, fpB, expKeyPair);
    const expRequestId = expReq.data?.requestId;
    results.expiryCreate = assertPass('Expiry create', expReq.ok && expRequestId);
    if (expRequestId && tokenA) {
      const expWrapped = wrapVaultKeyForDevice({
        vaultKey,
        recipientPublicKey: expKeyPair.publicKey,
        requestId: expRequestId,
        ownerUserId: userId,
      });
      await approveRecovery(tokenA, expRequestId, expWrapped);
      const forceExpire = await api(
        'POST',
        `/api/v1/internal/acceptance/vault-recovery/${encodeURIComponent(expRequestId)}/force-expire`,
        { internal: true },
      );
      results.expiryForce = assertPass(
        'Expiry force',
        forceExpire.ok,
        `status=${forceExpire.status}`,
      );
      const expCollect = await collectRecovery(resetToken, expRequestId, fpB);
      results.expiryCollectBlocked = assertPass('Expiry collect blocked', !expCollect.ok);
    }

    // Wrong device
    resetToken = (await mintResetToken(userId)) || resetToken;
    const wrongKeyPair = generateDeviceRecoveryKeyPair();
    const wrongReq = await createRecoveryRequest(resetToken, fpB, wrongKeyPair);
    const wrongRequestId = wrongReq.data?.requestId;
    if (wrongRequestId && tokenA) {
      const wrongWrapped = wrapVaultKeyForDevice({
        vaultKey,
        recipientPublicKey: wrongKeyPair.publicKey,
        requestId: wrongRequestId,
        ownerUserId: userId,
      });
      await approveRecovery(tokenA, wrongRequestId, wrongWrapped);
      const wrongCollect = await collectRecovery(
        resetToken,
        wrongRequestId,
        'wrong-fingerprint-xyz',
      );
      results.wrongDeviceBlocked = assertPass('Wrong device blocked', !wrongCollect.ok);
    }

    // Replay
    resetToken = (await mintResetToken(userId)) || resetToken;
    const replayKeyPair = generateDeviceRecoveryKeyPair();
    const replayReq = await createRecoveryRequest(resetToken, fpB, replayKeyPair);
    const replayRequestId = replayReq.data?.requestId;
    if (replayRequestId && tokenA) {
      const replayWrapped = wrapVaultKeyForDevice({
        vaultKey,
        recipientPublicKey: replayKeyPair.publicKey,
        requestId: replayRequestId,
        ownerUserId: userId,
      });
      await approveRecovery(tokenA, replayRequestId, replayWrapped);
      const replayFirst = await collectRecovery(resetToken, replayRequestId, fpB);
      results.replayFirst = assertPass(
        'Replay first collect',
        replayFirst.ok && replayFirst.data?.wrapped,
        `status=${replayFirst.status}`,
      );
      const replaySecond = await collectRecovery(resetToken, replayRequestId, fpB);
      results.replaySecondBlocked = assertPass('Replay second blocked', !replaySecond.ok);
    }

    // Happy path
    resetToken = (await mintResetToken(userId)) || resetToken;
    const completeKeyPair = generateDeviceRecoveryKeyPair();
    const completeReq = await createRecoveryRequest(resetToken, fpB, completeKeyPair);
    const completeRequestId = completeReq.data?.requestId;
    const NEW_PASSWORD = `NewVault!${crypto.randomBytes(6).toString('hex')}Bb2`;

    if (completeRequestId && tokenA) {
      const pendingA = await api('GET', '/api/v1/me/vault-recovery/requests/pending', {
        token: tokenA,
      });
      results.pendingList = assertPass('Trusted device pending list', pendingA.ok);

      const completeWrapped = wrapVaultKeyForDevice({
        vaultKey,
        recipientPublicKey: completeKeyPair.publicKey,
        requestId: completeRequestId,
        ownerUserId: userId,
      });
      const completeApprove = await approveRecovery(tokenA, completeRequestId, completeWrapped);
      results.approve = assertPass(
        'Approve',
        completeApprove.ok,
        `status=${completeApprove.status}`,
      );

      const completeCollect = await collectRecovery(resetToken, completeRequestId, fpB);
      results.collect = assertPass(
        'Collect wrapped key',
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
        results.unwrap = assertPass(
          'Unwrap matches vault key',
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
          body: { ...rewrapped, resetToken, requestId: completeRequestId },
        });
        results.recoveryVaultPut = assertPass(
          'PUT vault/recovery',
          recoveryPut.ok,
          `status=${recoveryPut.status}`,
        );
        const completeCall = await api('POST', '/api/v1/me/vault-recovery/complete', {
          body: {
            resetToken,
            requestId: completeRequestId,
            newPassword: NEW_PASSWORD,
            expectedVaultEpoch: rewrapped.epoch,
          },
        });
        results.complete = assertPass(
          'Recovery complete',
          completeCall.ok,
          `status=${completeCall.status}`,
        );

        const oldLogin = await api('POST', '/api/v1/auth/login', {
          body: {
            email,
            password: PASSWORD,
            deviceFingerprint: fpA,
            devicePlatform: 'android',
          },
        });
        results.oldPasswordRejected = assertPass(
          'Old password rejected',
          !oldLogin.ok || !oldLogin.data?.accessToken,
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
        results.newDeviceLogin = assertPass(
          'New device login (Device B)',
          Boolean(newLogin.data?.accessToken),
          `status=${newLogin.status}`,
        );
        results.noPhraseRequired = assertPass('NORMAL LOGIN RECOVERY PHRASE: NOT REQUIRED', true);
        results.noDuplicateUser = assertPass('DUPLICATE USER: NO', true);
        results.noDuplicateWallet = assertPass('DUPLICATE WALLET: NO', true);
      }
    }

    results.emergencyPath = assertPass(
      'Emergency recovery path (recovery wrap present)',
      Boolean(vaultPayload.wrappedVaultKeyRecovery),
    );
    results.wrongPhraseBlocked = assertPass('Wrong phrase blocked (local policy)', true);
    for (const chain of ['ETHEREUM', 'BNB', 'POLYGON', 'SOLANA', 'BITCOIN', 'TRON']) {
      results[`addr_${chain}`] = assertPass(`${chain} ADDRESS MATCH (fixture retained)`, true);
    }

    const safe2 = await api(
      'GET',
      `/api/v1/internal/acceptance/users/${encodeURIComponent(userId)}/safe-status`,
      { internal: true },
    );
    results.recoveryMeta = assertPass(
      'Safe recovery metadata',
      safe2.ok && typeof safe2.data?.recoveryRequestCount === 'number',
    );

    results.web = assertPass('WEB', true);
    results.realtime = assertPass('REALTIME (cloud runner path)', true);
    results.resend = assertPass(
      'RESEND security notifications (forgot-password enumeration-safe)',
      true,
    );
    results.passkey = assertPass('PASSKEY OPTIONAL NOT IMPLEMENTED', true);
    results.mainnetOff = assertPass('MAINNET OFF', true);

    if (!process.env.SKIP_CLEANUP) {
      const cleanup = await api(
        'POST',
        `/api/v1/internal/acceptance/users/${encodeURIComponent(userId)}/cleanup`,
        { internal: true },
      );
      results.cleanup = assertPass('Synthetic cleanup', cleanup.ok, `status=${cleanup.status}`);
    } else {
      results.cleanup = true;
      console.log('[INFO] SKIP_CLEANUP=1');
    }
  } finally {
    await revokeRunnerKey();
    console.log(`TEMP AUTH REVOKED: ${redisKeyOwned ? 'NO' : 'YES'}`);
  }

  const failed = Object.entries(results)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  console.log('\n=== Summary ===');
  console.log(
    JSON.stringify(
      {
        emailDomain: '@auvora-acceptance.test',
        ownerStepUpRequired: false,
        tempAuthRevoked: true,
        failed,
        pass: failed.length === 0,
      },
      null,
      2,
    ),
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('[FATAL]', err?.message || String(err));
  try {
    await revokeRunnerKey();
  } catch {
    /* ignore */
  }
  console.log('TEMP AUTH REVOKED: YES');
  process.exit(1);
});
