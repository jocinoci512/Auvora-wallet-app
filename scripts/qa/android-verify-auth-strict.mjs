#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const adb = 'D:\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'R5CW51ZMNLB';
const pkg = 'com.auvora.auvora_wallet.qa';
const run = (...a) => execFileSync(adb, ['-s', serial, ...a], { encoding: 'utf8' }).trim();
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function dump(name) {
  run('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  run('pull', '/sdcard/ui.xml', `artifacts/${name}`);
  return `artifacts/${name}`;
}
function texts(p) {
  const t = fs.readFileSync(p, 'utf8');
  return [
    ...[...t.matchAll(/content-desc="([^"]+)"/g)].map((m) =>
      m[1].replace(/&#10;/g, ' ').replace(/&amp;/g, '&'),
    ),
    ...[...t.matchAll(/\btext="([^"]+)"/g)].map((m) => m[1]),
  ].filter(Boolean);
}
function taps(p) {
  const t = fs.readFileSync(p, 'utf8');
  const out = [];
  for (const m of t.matchAll(/<node\b[^>]*>/g)) {
    const n = m[0];
    const b = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!b) continue;
    const d = n.match(/content-desc="([^"]*)"/);
    const x = n.match(/\btext="([^"]*)"/);
    const label = ((d && d[1]) || (x && x[1]) || '')
      .replace(/&#10;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    if (!label) continue;
    out.push({
      label,
      x: (Number(b[1]) + Number(b[3])) / 2,
      y: (Number(b[2]) + Number(b[4])) / 2,
    });
  }
  return out;
}
function tapLabel(screen, pred) {
  const hit = taps(screen).find(pred);
  if (!hit) return null;
  run('shell', 'input', 'tap', String(Math.round(hit.x)), String(Math.round(hit.y)));
  return hit.label;
}

// Close nested screens with Back until Home tabs visible
for (let i = 0; i < 6; i++) {
  let screen = dump(`ui-nav-back-${i}.xml`);
  const t = texts(screen).join(' | ');
  if (
    /Home Tab 1 of 4/i.test(t) &&
    /Assets Tab/i.test(t) &&
    !/Manage wallets|Auvora Account|Sign In/i.test(t)
  ) {
    break;
  }
  if (tapLabel(screen, (n) => /^Back$/i.test(n.label) || /^Close$/i.test(n.label))) {
    sleep(900);
    continue;
  }
  const home = tapLabel(screen, (n) => /^Home Tab/i.test(n.label));
  if (home) {
    sleep(1200);
    break;
  }
  run('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  sleep(900);
}

let screen = dump('ui-home-final.xml');
let homeJoined = texts(screen).join(' | ');
// Ensure on Home tab
if (!/Good |Total portfolio|Hide balances/i.test(homeJoined)) {
  tapLabel(screen, (n) => /^Home Tab/i.test(n.label));
  sleep(1500);
  screen = dump('ui-home-final2.xml');
  homeJoined = texts(screen).join(' | ');
}

const homeBanner = /Sign in again so this wallet/i.test(homeJoined);
const sessionExpired = /session has expired/i.test(homeJoined);

tapLabel(screen, (n) => /^More Tab/i.test(n.label));
sleep(1800);
screen = dump('ui-more-final.xml');
tapLabel(screen, (n) => /Auvora account/i.test(n.label));
sleep(2800);
screen = dump('ui-account-final.xml');
let accountTexts = texts(screen);
let accountJoined = accountTexts.join(' | ');

const onSignInForm =
  (/^Sign In$/i.test(accountTexts.find((x) => /^Sign In$/i.test(x)) || '') ||
    accountTexts.includes('Forgot password?')) &&
  /Create account/i.test(accountJoined);
const signedInLive =
  /Sign out/i.test(accountJoined) &&
  !/Sign in is required before encrypted vault sync/i.test(accountJoined) &&
  !onSignInForm;

const redacted = accountTexts
  .slice(0, 40)
  .map((s) =>
    s
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***')
      .replace(/Username\s+\S+/gi, 'Username ***'),
  );

const homeFile = fs.existsSync('artifacts/ui-home-final2.xml')
  ? 'artifacts/ui-home-final2.xml'
  : 'artifacts/ui-home-final.xml';
console.log(
  JSON.stringify(
    {
      homeBanner,
      sessionExpired,
      onSignInForm,
      signedInLive,
      hasSignOut: /Sign out/i.test(accountJoined),
      vaultSyncRequired: /Sign in is required before encrypted vault sync/i.test(accountJoined),
      homeSample: texts(homeFile).slice(0, 22),
      accountSample: redacted,
    },
    null,
    2,
  ),
);
console.log(signedInLive && !homeBanner ? 'AUTH_OK' : 'AUTH_FAIL');
process.exit(signedInLive && !homeBanner ? 0 : 2);
