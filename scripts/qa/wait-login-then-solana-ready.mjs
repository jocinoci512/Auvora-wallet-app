#!/usr/bin/env node
/**
 * LOCAL QA — wait for one new SUCCESS login for canonical user, verify Home, then Solana Ready.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const adb = fs.existsSync('E:\\AuvoraPortable\\Android\\Sdk\\platform-tools\\adb.exe')
  ? 'E:\\AuvoraPortable\\Android\\Sdk\\platform-tools\\adb.exe'
  : process.env.ANDROID_HOME
    ? `${process.env.ANDROID_HOME}\\platform-tools\\adb.exe`
    : 'D:\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'R5CW51ZMNLB';
const userId = 'df1db712-5e50-42c1-92fc-2c7236244cf8';

function dockerSql(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      'auvora-postgres',
      'psql',
      '-U',
      'auvora',
      '-d',
      'auvora_wallet',
      '-t',
      '-A',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim();
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function homeState() {
  execFileSync(adb, ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/ui.xml'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  execFileSync(adb, ['-s', serial, 'pull', '/sdcard/ui.xml', 'artifacts/ui-wait-login-home.xml'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const t = fs.readFileSync('artifacts/ui-wait-login-home.xml', 'utf8');
  return {
    banner: /Sign in again so this wallet|session has expired/i.test(t),
    signInForm: /Forgot password/i.test(t),
    home: /Home Tab 1 of 4/i.test(t),
    localQa: /LOCAL QA/i.test(t),
  };
}

const before = Number(
  dockerSql(`SELECT count(*) FROM login_history WHERE user_id='${userId}' AND outcome='SUCCESS'`) ||
    '0',
);

console.log('AUVORA AUTH CAPTURE READY');
console.log(
  'ACTION REQUIRED: Enter the existing Auvora QA email/password once on the Samsung Sign in screen and tap Sign in. Do not send the password to Cursor.',
);
console.log(`baseline_success_logins=${before}`);

const deadline = Date.now() + 12 * 60 * 1000;
let ok = false;
while (Date.now() < deadline) {
  const after = Number(
    dockerSql(
      `SELECT count(*) FROM login_history WHERE user_id='${userId}' AND outcome='SUCCESS'`,
    ) || '0',
  );
  const latest = dockerSql(
    `SELECT outcome::text FROM login_history WHERE user_id='${userId}' ORDER BY created_at DESC LIMIT 1`,
  );
  if (after > before && latest === 'SUCCESS') {
    sleep(3000);
    const ui = homeState();
    console.log('detected_new_success', { after, ui });
    if (!ui.banner && !ui.signInForm) {
      ok = true;
      break;
    }
    // signed in but banner lag — keep waiting briefly
    console.log('waiting for Home sign-in banner to clear...');
  } else if (latest && latest !== 'SUCCESS') {
    console.log('latest_login_outcome', latest);
  }
  sleep(4000);
}

if (!ok) {
  console.log('TIMEOUT_WAITING_FOR_LOGIN');
  process.exit(2);
}

console.log('AUTH_OK — starting Solana Ready (no Sign)');
const ready = spawnSync(process.execPath, ['scripts/qa/android-solana-ready-presign.mjs'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 200000,
});
process.stdout.write(ready.stdout || '');
process.stderr.write(ready.stderr || '');
process.exit(ready.status ?? 1);
