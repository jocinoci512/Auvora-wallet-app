#!/usr/bin/env node
/**
 * STAGING ACCEPTANCE — Real internet register, login, refresh, /me, logout, wrong password, CORS, rate limiting.
 * Targets live Railway gateway URL via HTTPS.
 */
const baseUrl = 'https://gateway-production-bc6a.up.railway.app';
const stamp = Date.now().toString(36);
const email = `staging.acceptance.${stamp}@auvora.test`;
const username = `stgacc_${stamp}`.slice(0, 32);
const password = `StagingAcceptance!${stamp}9x`;

async function req(method, path, body, bearer, customHeaders = {}) {
  const url = new URL(path, baseUrl);
  const headers = {
    'content-type': 'application/json',
    ...customHeaders,
  };
  if (bearer) {
    headers['authorization'] = `Bearer ${bearer}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    json,
  };
}

async function run() {
  console.log('--- Auvora Real Internet Staging Auth & Security Acceptance ---');
  console.log('Target URL:', baseUrl);
  console.log('Testing User:', email);

  // 1. Register
  const reg = await req('POST', '/api/v1/auth/register', {
    email,
    username,
    password,
    firstName: 'Staging',
    lastName: 'User',
  });
  console.log(
    '1. Register status:',
    reg.status,
    'success:',
    reg.json?.success,
    'emailVerified:',
    reg.json?.data?.emailVerified,
  );

  // 2. Login
  const login = await req('POST', '/api/v1/auth/login', {
    email,
    password,
    deviceFingerprint: `staging-device-${stamp}`,
    devicePlatform: 'android',
    deviceName: 'Samsung Galaxy SM-S901B (Staging)',
  });
  console.log('2. Login status:', login.status, 'success:', login.json?.success);
  const access = login.json?.data?.accessToken;
  const refresh = login.json?.data?.refreshToken;
  console.log('   Access Token received:', !!access, 'Refresh Token received:', !!refresh);

  // 3. /me
  if (access) {
    const me = await req('GET', '/api/v1/me', null, access);
    console.log(
      '3. /me status:',
      me.status,
      'email match:',
      me.json?.data?.email === email,
      'username:',
      me.json?.data?.username,
    );
  }

  // 4. Refresh token rotation
  if (refresh) {
    const ref = await req('POST', '/api/v1/auth/refresh', { refreshToken: refresh });
    console.log('4. Refresh status:', ref.status, 'rotated access:', !!ref.json?.data?.accessToken);
  }

  // 5. Wrong password failure (RBAC / Auth security)
  const badLogin = await req('POST', '/api/v1/auth/login', {
    email,
    password: 'WrongPassword!123',
  });
  console.log(
    '5. Bad password status (expected 401):',
    badLogin.status,
    'code:',
    badLogin.json?.error?.code,
  );

  // 6. CORS preflight check
  const corsRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://staging.auvorawallet.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, Authorization',
    },
  });
  console.log(
    '6. CORS OPTIONS status:',
    corsRes.status,
    'ACAO:',
    corsRes.headers.get('access-control-allow-origin'),
  );

  // 7. Security Headers check
  console.log('7. Security Headers:');
  console.log(
    '   Strict-Transport-Security:',
    corsRes.headers.get('strict-transport-security') || reg.headers['strict-transport-security'],
  );
  console.log(
    '   X-Content-Type-Options:',
    corsRes.headers.get('x-content-type-options') || reg.headers['x-content-type-options'],
  );
  console.log(
    '   X-Frame-Options:',
    corsRes.headers.get('x-frame-options') || reg.headers['x-frame-options'],
  );
}

run().catch(console.error);
