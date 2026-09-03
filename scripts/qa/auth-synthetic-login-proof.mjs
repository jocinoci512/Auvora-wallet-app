#!/usr/bin/env node
/**
 * LOCAL QA — synthetic register/login/refresh/me via Gateway.
 * Never prints tokens or passwords.
 */
import fs from 'node:fs';
import http from 'node:http';

const gateway = 'http://127.0.0.1:4000';
const stamp = Date.now().toString(36);
const email = `qa.synth.${stamp}@local.test`;
const username = `qasynth_${stamp}`.slice(0, 32);
const password = `SynthQaLogin!${stamp}9x`;

function req(method, path, body, bearer) {
  const payload = body ? JSON.stringify(body) : null;
  const u = new URL(path, gateway);
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method,
        headers: {
          'content-type': 'application/json',
          ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            json = { raw: data.slice(0, 200) };
          }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

const report = {
  register: null,
  login: null,
  me: null,
  refresh: null,
  loginAfterLogoutShape: null,
  hasAccess: false,
  hasRefresh: false,
  sessionIdPresent: false,
};

const reg = await req('POST', '/api/v1/auth/register', {
  email,
  username,
  password,
  firstName: 'Synth',
  lastName: 'Qa',
});
report.register = {
  status: reg.status,
  success: !!reg.json?.success,
  error: reg.json?.error?.code || null,
};

const login = await req('POST', '/api/v1/auth/login', {
  email,
  password,
  deviceFingerprint: `synth-fp-${stamp}`,
  devicePlatform: 'android',
  deviceName: 'synth-qa',
});
report.login = {
  status: login.status,
  success: !!login.json?.success,
  error: login.json?.error?.code || null,
};
const access = login.json?.data?.accessToken;
const refresh = login.json?.data?.refreshToken;
report.hasAccess = typeof access === 'string' && access.length > 20;
report.hasRefresh = typeof refresh === 'string' && refresh.length > 20;
report.sessionIdPresent = Boolean(login.json?.data?.sessionId);

if (access) {
  const me = await req('GET', '/api/v1/me', null, access);
  report.me = {
    status: me.status,
    success: !!me.json?.success,
    emailMatches: (me.json?.data?.email || '').toLowerCase() === email.toLowerCase(),
    error: me.json?.error?.code || null,
  };
}

if (refresh) {
  const ref = await req('POST', '/api/v1/auth/refresh', { refreshToken: refresh });
  report.refresh = {
    status: ref.status,
    success: !!ref.json?.success,
    rotatedAccess:
      typeof ref.json?.data?.accessToken === 'string' && ref.json.data.accessToken.length > 20,
    rotatedRefresh:
      typeof ref.json?.data?.refreshToken === 'string' && ref.json.data.refreshToken.length > 20,
    error: ref.json?.error?.code || null,
  };
}

// Wrong password should be 401 not 500
const bad = await req('POST', '/api/v1/auth/login', {
  email,
  password: 'DefinitelyNotThePassword!!!',
  deviceFingerprint: `synth-fp-bad-${stamp}`,
  devicePlatform: 'android',
});
report.wrongPassword = { status: bad.status, code: bad.json?.error?.code || null };

// Existing-user wrong password should also not 500
const existingProbe = await req('POST', '/api/v1/auth/login', {
  email: 'emmilianjoan@gmail.com',
  password: 'DefinitelyNotThePassword!!!',
  deviceFingerprint: `exist-fp-${stamp}`,
  devicePlatform: 'android',
});
report.existingAccountWrongPassword = {
  status: existingProbe.status,
  code: existingProbe.json?.error?.code || null,
  // 401 invalid vs 403 unverified vs 423 locked vs 500 broken
};

fs.writeFileSync(
  'artifacts/auth-synthetic-result.json',
  JSON.stringify({ ...report, emailMasked: email.replace(/@.*/, '@***') }, null, 2),
);
console.log(JSON.stringify({ ...report, emailMasked: email.replace(/@.*/, '@***') }, null, 2));
const ok =
  report.register?.success &&
  report.login?.success &&
  report.hasAccess &&
  report.hasRefresh &&
  report.me?.success &&
  report.refresh?.success &&
  report.wrongPassword?.status === 401 &&
  report.existingAccountWrongPassword?.status !== 500;
process.exit(ok ? 0 : 2);
