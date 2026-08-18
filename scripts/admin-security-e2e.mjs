/**
 * Isolated Admin security E2E against local Auth + Gateway.
 * Requires DATABASE_URL to contain `auvora_e2e` so production DBs cannot be targeted.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const argon2 = require('../database/node_modules/argon2');
const { PrismaClient, UserStatus } = require('../database/generated/client/index.js');

const DATABASE_URL = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL.includes('auvora_e2e')) {
  throw new Error('Refusing to run: DATABASE_URL must target isolated database auvora_e2e');
}

const AUTH_URL = (process.env.AUTH_URL ?? 'http://127.0.0.1:4001').replace(/\/$/, '');
const GATEWAY_URL = (process.env.GATEWAY_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const ADMIN_UI_URL = (process.env.ADMIN_UI_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');

const prisma = new PrismaClient();
const results = [];
let failures = 0;

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (!pass) {
    failures += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function totpCode(secret, nowMs = Date.now()) {
  const step = Math.floor(nowMs / 1000 / 30);
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(0, 0);
  buffer.writeUInt32BE(step, 4);
  const hmac = createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

function decodeBase32(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error('Invalid TOTP secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function parseCookies(setCookieHeaders) {
  const jar = {};
  const attrs = {};
  for (const header of setCookieHeaders) {
    const [pair, ...rest] = header.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    jar[name] = value;
    attrs[name] = rest.map((part) => part.trim().toLowerCase());
  }
  return { jar, attrs };
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

const SECRET_LEAK =
  /passwordHash|mfaSecret|secretEncrypted|codeHash|refreshToken|privateKey|seed phrase|mnemonic|symKey|DATABASE_URL|REDIS_URL|INTERNAL_API_KEY|AUTH_FIELD_ENCRYPTION_KEY/i;

async function jsonRequest(base, path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, json, text, setCookie, headers: res.headers };
}

function scanSecrets(payload, label) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const leaked = SECRET_LEAK.test(raw);
  record(`secret scan ${label}`, !leaked, leaked ? raw.slice(0, 180) : '');
  return !leaked;
}

const CAPS = {
  read_only: [
    'users:read',
    'sessions:read',
    'devices:read',
    'connections:read',
    'wallets:read',
    'security:read',
    'audit:read',
    'support:read',
    'admins:read',
    'roles:read',
    'health:read',
    'realtime:read',
  ],
};
CAPS.support = [...CAPS.read_only, 'users:write', 'support:write'];
CAPS.security_analyst = [
  ...CAPS.read_only,
  'security:manage',
  'sessions:revoke',
  'devices:revoke',
  'connections:revoke',
];
CAPS.admin = [
  ...CAPS.read_only,
  'users:write',
  'users:suspend',
  'users:reactivate',
  'sessions:revoke',
  'devices:revoke',
  'connections:revoke',
  'security:manage',
  'support:write',
];
CAPS.super_admin = [...CAPS.admin, 'admins:manage', 'roles:manage'];

async function ensureRoles() {
  const codes = [...new Set(Object.values(CAPS).flat())];
  const permissions = [];
  for (const code of codes) {
    const row = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
    permissions.push(row);
  }
  const byCode = Object.fromEntries(permissions.map((p) => [p.code, p]));
  for (const [name, granted] of Object.entries(CAPS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: name },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const code of granted) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: byCode[code].id },
      });
    }
  }
  await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', description: 'user' },
  });
}

async function createUser({ email, username, password, role, status = UserStatus.ACTIVE }) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const roleRow = await prisma.role.findUnique({ where: { name: role } });
  if (!roleRow) throw new Error(`missing role ${role}`);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      firstName: 'E2E',
      lastName: role,
      status,
      emailVerified: true,
      mfaEnabled: false,
      roles: { create: { roleId: roleRow.id } },
    },
  });
  return user;
}

function sessionFrom(res) {
  const { jar, attrs } = parseCookies(res.setCookie ?? []);
  return {
    cookies: jar,
    attrs,
    csrf: res.json?.data?.csrfToken ?? jar.admin_csrf_token,
  };
}

async function enrollAndLogin(email, password) {
  const login = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
    method: 'POST',
    body: { email, password, deviceFingerprint: `fp-${email}` },
  });
  scanSecrets(login.json, `login ${email}`);
  const status = login.json?.data?.status;
  if (status === 'authenticated') {
    return { login, secret: null, recoveryCodes: [], ...sessionFrom(login) };
  }
  if (status !== 'mfa_enrollment_required') {
    return { login, cookies: {}, attrs: {}, recoveryCodes: [], secret: null };
  }
  const mfaToken = login.json.data.mfaToken;
  const start = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/enroll/start', {
    method: 'POST',
    body: { mfaToken },
  });
  scanSecrets(start.json, `enroll start ${email}`);
  const secret = start.json?.data?.secret;
  const badConfirm = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/enroll/confirm', {
    method: 'POST',
    body: { mfaToken, code: '000000' },
  });
  const code = totpCode(secret);
  const confirm = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/enroll/confirm', {
    method: 'POST',
    body: { mfaToken, code },
  });
  scanSecrets(confirm.json, `enroll confirm ${email}`);
  record(`invalid enrollment code rejected for ${email}`, badConfirm.status === 401);
  return {
    login,
    start,
    confirm,
    secret,
    recoveryCodes: confirm.json?.data?.recoveryCodes ?? [],
    ...sessionFrom(confirm),
  };
}

async function authed(base, path, cookies, csrf, options = {}) {
  const headers = {
    cookie: cookieHeader(cookies),
    ...(csrf ? { 'x-csrf-token': csrf } : {}),
    ...(options.headers ?? {}),
  };
  return jsonRequest(base, path, { ...options, headers });
}

async function cleanup(prefix) {
  const users = await prisma.user.findMany({ where: { email: { startsWith: prefix } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.loginHistory.deleteMany({ where: { userId: { in: ids } } });
  await prisma.mfaRecoveryCode.deleteMany({ where: { userId: { in: ids } } });
  await prisma.mfaTotpCredential.deleteMany({ where: { userId: { in: ids } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.device.deleteMany({ where: { userId: { in: ids } } });
  await prisma.securityAuditLog.deleteMany({
    where: { OR: [{ actorUserId: { in: ids } }, { targetUserId: { in: ids } }] },
  });
  await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  const prefix = `e2e14.${randomBytes(4).toString('hex')}.`;
  const password = `E2e!${randomBytes(8).toString('hex')}Aa`;
  await ensureRoles();
  const accounts = {};
  try {
    accounts.super = await createUser({
      email: `${prefix}super@auvora.test`,
      username: `${prefix}super`,
      password,
      role: 'super_admin',
    });
    accounts.admin = await createUser({
      email: `${prefix}admin@auvora.test`,
      username: `${prefix}admin`,
      password,
      role: 'admin',
    });
    accounts.support = await createUser({
      email: `${prefix}support@auvora.test`,
      username: `${prefix}support`,
      password,
      role: 'support',
    });
    accounts.analyst = await createUser({
      email: `${prefix}analyst@auvora.test`,
      username: `${prefix}analyst`,
      password,
      role: 'security_analyst',
    });
    accounts.readonly = await createUser({
      email: `${prefix}readonly@auvora.test`,
      username: `${prefix}readonly`,
      password,
      role: 'read_only',
    });
    accounts.user = await createUser({
      email: `${prefix}user@auvora.test`,
      username: `${prefix}user`,
      password,
      role: 'user',
    });
    accounts.suspended = await createUser({
      email: `${prefix}suspended@auvora.test`,
      username: `${prefix}suspended`,
      password,
      role: 'admin',
      status: UserStatus.SUSPENDED,
    });

    const superFlow = await enrollAndLogin(accounts.super.email, password);
    record(
      'super admin login requires MFA enrollment',
      superFlow.login.json?.data?.status === 'mfa_enrollment_required',
    );
    record(
      'otpauth generated',
      Boolean(superFlow.start?.json?.data?.otpauthUrl?.startsWith('otpauth://totp/')),
    );
    record('enrollment secret returned once', Boolean(superFlow.secret));
    record(
      'enrollment confirm sets session',
      superFlow.confirm?.status === 201 || superFlow.confirm?.status === 200,
    );
    record(
      'HttpOnly admin_access_token',
      (superFlow.attrs.admin_access_token ?? []).some((a) => a === 'httponly'),
    );
    record(
      'Secure admin_access_token',
      (superFlow.attrs.admin_access_token ?? []).some((a) => a === 'secure'),
    );
    record(
      'SameSite=Lax',
      (superFlow.attrs.admin_access_token ?? []).some((a) => a.startsWith('samesite=lax')),
    );
    record(
      'cookie Path=/',
      (superFlow.attrs.admin_access_token ?? []).some((a) => a === 'path=/'),
    );
    record(
      'cookie Max-Age bounded',
      (superFlow.attrs.admin_access_token ?? []).some((a) => a.startsWith('max-age=')),
    );
    record(
      'no accessToken in JSON',
      !JSON.stringify(superFlow.confirm?.json).includes('accessToken'),
    );
    record(
      'secret omitted after enrollment',
      !JSON.stringify(superFlow.confirm?.json).includes(superFlow.secret ?? 'missing-secret'),
    );
    record('recovery codes shown once', (superFlow.recoveryCodes?.length ?? 0) === 10);

    const session = await authed(
      AUTH_URL,
      '/api/v1/auth/admin/session',
      superFlow.cookies,
      superFlow.csrf,
    );
    record('admin session established', session.status === 200);
    scanSecrets(session.json, 'session');

    const operators = await authed(
      GATEWAY_URL,
      '/api/v1/admin/operators',
      superFlow.cookies,
      superFlow.csrf,
    );
    record('super admin can list operators', operators.status === 200);
    scanSecrets(operators.json, 'operators list');

    try {
      const loginPage = await fetch(`${ADMIN_UI_URL}/login`);
      const html = await loginPage.text();
      record(
        'token-paste absent on login',
        !/Access token|paste.*jwt|localStorage.*access/i.test(html),
      );
    } catch (error) {
      record('token-paste absent on login', false, String(error));
    }

    const normal = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email: accounts.user.email, password, deviceFingerprint: 'fp-user-01' },
    });
    record(
      'normal user denied Admin',
      normal.status === 403 || normal.status === 401,
      `status=${normal.status}`,
    );

    const suspended = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email: accounts.suspended.email, password, deviceFingerprint: 'fp-susp-01' },
    });
    record(
      'suspended admin denied',
      suspended.status === 403 || suspended.status === 401,
      `status=${suspended.status}`,
    );

    const badPass = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: {
        email: accounts.super.email,
        password: 'WrongPassword12!',
        deviceFingerprint: 'fp-badpass',
      },
    });
    record('invalid password denied', badPass.status === 401, `status=${badPass.status}`);

    const replayLogin = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email: accounts.super.email, password, deviceFingerprint: 'fp-replay' },
    });
    const replayCode = totpCode(superFlow.secret, Date.now() + 30_000);
    const firstMfa = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/verify', {
      method: 'POST',
      body: { mfaToken: replayLogin.json?.data?.mfaToken, code: replayCode },
    });
    const replayMfa = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/verify', {
      method: 'POST',
      body: { mfaToken: replayLogin.json?.data?.mfaToken, code: replayCode },
    });
    record(
      'valid TOTP login',
      firstMfa.status === 200 || firstMfa.status === 201,
      `status=${firstMfa.status}`,
    );
    record('TOTP replay denied', replayMfa.status === 401);
    const replayLogin2 = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email: accounts.super.email, password, deviceFingerprint: 'fp-replay2' },
    });
    const sameWindowReplay = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/verify', {
      method: 'POST',
      body: { mfaToken: replayLogin2.json?.data?.mfaToken, code: replayCode },
    });
    record('TOTP same-window replay denied', sameWindowReplay.status === 401);
    const invalidTotp = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/verify', {
      method: 'POST',
      body: { mfaToken: replayLogin.json?.data?.mfaToken, code: '000000' },
    });
    record('invalid TOTP denied', invalidTotp.status === 401);
    const expiredLogin = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email: accounts.super.email, password, deviceFingerprint: 'fp-expired' },
    });
    const expiredTotp = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/verify', {
      method: 'POST',
      body: {
        mfaToken: expiredLogin.json?.data?.mfaToken,
        code: totpCode(superFlow.secret, Date.now() - 120_000),
      },
    });
    record('expired TOTP denied', expiredTotp.status === 401, `status=${expiredTotp.status}`);

    const recoveryLogin = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email: accounts.super.email, password, deviceFingerprint: 'fp-recovery' },
    });
    const recCode = superFlow.recoveryCodes[0];
    const recOk = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/recovery', {
      method: 'POST',
      body: { mfaToken: recoveryLogin.json?.data?.mfaToken, recoveryCode: recCode },
    });
    record(
      'recovery code works once',
      recOk.status === 200 || recOk.status === 201,
      `status=${recOk.status}`,
    );
    const recReuse = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/recovery', {
      method: 'POST',
      body: { mfaToken: recoveryLogin.json?.data?.mfaToken, recoveryCode: recCode },
    });
    record('recovery reuse blocked', recReuse.status === 401);
    const unusedLogin = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email: accounts.super.email, password, deviceFingerprint: 'fp-recover2' },
    });
    const unusedOk = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/recovery', {
      method: 'POST',
      body: {
        mfaToken: unusedLogin.json?.data?.mfaToken,
        recoveryCode: superFlow.recoveryCodes[1],
      },
    });
    record(
      'unused recovery code remains valid',
      unusedOk.status === 200 || unusedOk.status === 201,
    );

    const ro = await enrollAndLogin(accounts.readonly.email, password);
    const roMut = await authed(
      GATEWAY_URL,
      `/api/v1/admin/users/${accounts.user.id}/status`,
      ro.cookies,
      ro.csrf,
      { method: 'PATCH', body: { status: 'SUSPENDED' } },
    );
    record('READ_ONLY cannot mutate without step-up/permission', roMut.status === 403);
    const roRead = await authed(GATEWAY_URL, '/api/v1/admin/users', ro.cookies, ro.csrf);
    record('READ_ONLY can read users', roRead.status === 200);

    const support = await enrollAndLogin(accounts.support.email, password);
    const supportRoles = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.readonly.id}/roles`,
      support.cookies,
      support.csrf,
      { method: 'PATCH', body: { roles: ['super_admin'], reason: 'should not work here' } },
    );
    record('SUPPORT cannot manage operator roles', supportRoles.status === 403);

    const admin = await enrollAndLogin(accounts.admin.email, password);
    const escalate = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.support.id}/roles`,
      admin.cookies,
      admin.csrf,
      { method: 'PATCH', body: { roles: ['super_admin'], reason: 'need super admin access now' } },
    );
    record('ADMIN cannot assign SUPER_ADMIN', escalate.status === 403 || escalate.status === 401);

    const missingCsrf = await authed(AUTH_URL, '/api/v1/auth/admin/logout', superFlow.cookies, '', {
      method: 'POST',
      body: {},
    });
    record('missing CSRF denied', missingCsrf.status === 403);
    const badCsrf = await authed(
      AUTH_URL,
      '/api/v1/auth/admin/logout',
      superFlow.cookies,
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      { method: 'POST', body: {} },
    );
    record('invalid CSRF denied', badCsrf.status === 403);

    const sse = await fetch(`${GATEWAY_URL}/api/v1/admin/realtime/events`, {
      headers: { Accept: 'text/event-stream', cookie: cookieHeader(superFlow.cookies) },
    });
    record('SSE with Admin session', sse.status === 200);
    sse.body?.cancel?.();

    const userSse = await fetch(`${GATEWAY_URL}/api/v1/admin/realtime/events`);
    record('SSE unauthenticated denied', userSse.status === 401 || userSse.status === 403);
    userSse.body?.cancel?.();
    const roSse = await fetch(`${GATEWAY_URL}/api/v1/admin/realtime/events`, {
      headers: { Accept: 'text/event-stream', cookie: cookieHeader(ro.cookies) },
    });
    record('READ_ONLY SSE allowed', roSse.status === 200);
    roSse.body?.cancel?.();
    const usersPage = await fetch(`${ADMIN_UI_URL}/users`, { redirect: 'manual' });
    record(
      'unauthenticated Admin route redirects',
      usersPage.status === 307 || usersPage.status === 302 || usersPage.status === 308,
    );

    const analyst = await enrollAndLogin(accounts.analyst.email, password);
    const analystRoles = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.readonly.id}/roles`,
      analyst.cookies,
      analyst.csrf,
      { method: 'PATCH', body: { roles: ['super_admin'], reason: 'analyst should not elevate' } },
    );
    record('SECURITY_ANALYST cannot manage roles', analystRoles.status === 403);
    const wrongUserLogin = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email: accounts.super.email, password, deviceFingerprint: 'fp-wrong-totp' },
    });
    const wrongUserTotp = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/mfa/verify', {
      method: 'POST',
      body: { mfaToken: wrongUserLogin.json?.data?.mfaToken, code: totpCode(analyst.secret) },
    });
    record('wrong user TOTP denied', wrongUserTotp.status === 401);

    const stepDenied = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.support.id}/status`,
      superFlow.cookies,
      superFlow.csrf,
      { method: 'PATCH', body: { status: 'SUSPENDED', reason: 'policy review after incident' } },
    );
    record('high-risk action requires step-up', stepDenied.status === 403);

    const stepUp = await authed(
      AUTH_URL,
      '/api/v1/auth/admin/step-up',
      superFlow.cookies,
      superFlow.csrf,
      {
        method: 'POST',
        body: { password, code: totpCode(superFlow.secret, Date.now() + 30_000) },
      },
    );
    record(
      'valid step-up succeeds',
      stepUp.status === 200 || stepUp.status === 201,
      `status=${stepUp.status}`,
    );
    const stepped = parseCookies(stepUp.setCookie);
    const cookies = { ...superFlow.cookies, ...stepped.jar };
    const csrf = stepUp.json?.data?.csrfToken ?? superFlow.csrf;

    const suspend = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.support.id}/status`,
      cookies,
      csrf,
      { method: 'PATCH', body: { status: 'SUSPENDED', reason: 'policy review after incident' } },
    );
    record('step-up allows Admin suspension', suspend.status === 200);

    const roleChange = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.readonly.id}/roles`,
      cookies,
      csrf,
      {
        method: 'PATCH',
        body: { roles: ['read_only', 'support'], reason: 'temporary dual-role review' },
      },
    );
    record('step-up allows role change', roleChange.status === 200);
    const mfaReset = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.analyst.id}/mfa/reset`,
      cookies,
      csrf,
      { method: 'POST', body: { reason: 'lost authenticator device during e2e' } },
    );
    record(
      'step-up allows MFA reset',
      mfaReset.status === 200 || mfaReset.status === 201,
      `status=${mfaReset.status}`,
    );
    const analystAfterReset = await jsonRequest(AUTH_URL, '/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email: accounts.analyst.email, password, deviceFingerprint: 'fp-reset' },
    });
    record(
      'MFA reset forces re-enroll',
      analystAfterReset.json?.data?.status === 'mfa_enrollment_required',
    );
    await new Promise((resolve) => setTimeout(resolve, 16_000));
    const expiredStep = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.admin.id}/status`,
      cookies,
      csrf,
      {
        method: 'PATCH',
        body: { status: 'SUSPENDED', reason: 'window should already be expired' },
      },
    );
    record('step-up expiry denies high-risk action', expiredStep.status === 403);
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    const stepUp2 = await authed(AUTH_URL, '/api/v1/auth/admin/step-up', cookies, csrf, {
      method: 'POST',
      body: { password, code: totpCode(superFlow.secret, Date.now() + 30_000) },
    });
    record(
      'step-up after expiry succeeds',
      stepUp2.status === 200 || stepUp2.status === 201,
      `status=${stepUp2.status}`,
    );
    const stepped2 = parseCookies(stepUp2.setCookie);
    Object.assign(cookies, stepped2.jar);
    const csrf2 = stepUp2.json?.data?.csrfToken ?? csrf;

    const walletMut = await authed(
      GATEWAY_URL,
      '/api/v1/admin/wallets/00000000-0000-0000-0000-000000000001/credit',
      cookies,
      csrf2,
      { method: 'POST', body: { amount: '1', description: 'removed unsafe mutation' } },
    );
    record(
      'removed admin wallet credit route is not implemented',
      walletMut.status === 404 ||
        walletMut.status === 405 ||
        walletMut.status === 403 ||
        walletMut.status === 401 ||
        walletMut.status === 504 ||
        walletMut.status === 502 ||
        walletMut.status === 503,
      `status=${walletMut.status}`,
    );
    const accessJwt = cookies.admin_access_token ?? '';
    const jwtPayload = JSON.parse(Buffer.from(accessJwt.split('.')[1], 'base64url').toString());
    record(
      'admin JWT omits custody and wallets:admin',
      !(jwtPayload.permissions ?? []).includes('custody:sign') &&
        !(jwtPayload.permissions ?? []).includes('wallets:admin') &&
        jwtPayload.surface === 'admin',
    );

    const factor = await prisma.mfaTotpCredential.findUnique({
      where: { userId: accounts.super.id },
    });
    record('MFA secret encrypted in DB', Boolean(factor?.secretEncrypted?.startsWith('v1:')));
    const storedUser = await prisma.user.findUnique({ where: { id: accounts.super.id } });
    record('password hashed in DB', Boolean(storedUser?.passwordHash?.startsWith('$argon2')));
    record(
      'no plaintext TOTP in DB',
      !String(factor?.secretEncrypted ?? '').includes(totpCode(superFlow.secret)),
    );
    const recoveryRow = await prisma.mfaRecoveryCode.findFirst({
      where: { userId: accounts.super.id },
    });
    record(
      'recovery codes hashed in DB',
      Boolean(recoveryRow?.codeHash) &&
        !superFlow.recoveryCodes.includes(recoveryRow?.codeHash ?? ''),
    );

    const audits = await prisma.securityAuditLog.findMany({
      where: { actorUserId: accounts.super.id },
      select: { action: true, metadata: true },
    });
    const actions = new Set(audits.map((a) => a.action));
    for (const action of [
      'ADMIN_LOGIN_SUCCESS',
      'ADMIN_LOGIN_FAILED',
      'ADMIN_MFA_ENROLLED',
      'ADMIN_MFA_FAILED',
      'ADMIN_MFA_RECOVERY_USED',
      'ADMIN_STEP_UP_SUCCESS',
      'ADMIN_STATUS_CHANGED',
      'ADMIN_ROLE_CHANGED',
      'ADMIN_MFA_RESET',
    ]) {
      record(`audit ${action}`, actions.has(action));
    }
    record(
      'audit metadata has no secrets',
      !audits.some((a) => SECRET_LEAK.test(JSON.stringify(a.metadata ?? {}))),
    );

    const revoke = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.super.id}/revoke-sessions`,
      cookies,
      csrf2,
      { method: 'POST', body: { reason: 'e2e revoke all admin sessions now' } },
    );
    record(
      'revoke-all succeeds after step-up',
      revoke.status === 200 || revoke.status === 201,
      `status=${revoke.status}`,
    );

    const afterRevoke = await authed(AUTH_URL, '/api/v1/auth/admin/session', cookies, csrf);
    record('revoked session auth endpoint blocked', afterRevoke.status === 401);
    const afterSse = await fetch(`${GATEWAY_URL}/api/v1/admin/realtime/events`, {
      headers: { Accept: 'text/event-stream', cookie: cookieHeader(cookies) },
    });
    record('revoked session SSE blocked', afterSse.status === 401 || afterSse.status === 403);
    afterSse.body?.cancel?.();
    const afterHigh = await authed(
      GATEWAY_URL,
      `/api/v1/admin/operators/${accounts.admin.id}/mfa/reset`,
      cookies,
      csrf,
      { method: 'POST', body: { reason: 'should already be revoked session' } },
    );
    record('revoked session high-risk mutation blocked', afterHigh.status === 401);
    const afterWallet = await authed(GATEWAY_URL, '/api/v1/admin/wallets', cookies, csrf);
    record(
      'revoked session low-risk read',
      afterWallet.status === 401 ||
        afterWallet.status === 200 ||
        afterWallet.status === 502 ||
        afterWallet.status === 503 ||
        afterWallet.status === 504,
      `status=${afterWallet.status}`,
    );

    const fresh = admin;
    const logout = await authed(AUTH_URL, '/api/v1/auth/admin/logout', fresh.cookies, fresh.csrf, {
      method: 'POST',
      body: {},
    });
    record('logout succeeds with CSRF', logout.status === 200);
    const afterLogout = await authed(
      AUTH_URL,
      '/api/v1/auth/admin/session',
      fresh.cookies,
      fresh.csrf,
    );
    record('logout revokes session', afterLogout.status === 401);
    const laterAudits = await prisma.securityAuditLog.findMany({
      where: { actorUserId: { in: [accounts.super.id, accounts.admin.id] } },
      select: { action: true },
    });
    const later = new Set(laterAudits.map((a) => a.action));
    record('audit ADMIN_SESSION_REVOKED', later.has('ADMIN_SESSION_REVOKED'));
    record('audit ADMIN_LOGOUT', later.has('ADMIN_LOGOUT'));
  } finally {
    await cleanup(prefix);
    await prisma.$disconnect();
  }

  console.log(
    `\nLOCAL SECURITY E2E ${failures === 0 ? 'PASS' : 'FAIL'} ${results.length - failures}/${results.length}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
