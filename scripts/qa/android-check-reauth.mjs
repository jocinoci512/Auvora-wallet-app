#!/usr/bin/env node
/**
 * LOCAL QA — open Profile/Account to detect auth state. No credential entry.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const adb = 'D:\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'R5CW51ZMNLB';
const run = (...a) => execFileSync(adb, ['-s', serial, ...a], { encoding: 'utf8' }).trim();
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function dump(name) {
  run('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  run('pull', '/sdcard/ui.xml', `artifacts/${name}`);
  return `artifacts/${name}`;
}
function texts(p) {
  const t = fs.readFileSync(p, 'utf8');
  const descs = [...t.matchAll(/content-desc="([^"]+)"/g)].map((m) =>
    m[1].replace(/&#10;/g, ' ').replace(/&amp;/g, '&'),
  );
  const plain = [...t.matchAll(/\btext="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
  return [...descs, ...plain];
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
function tap(x, y) {
  run('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
}

run('reverse', 'tcp:4000', 'tcp:4000');
run('reverse', 'tcp:8545', 'tcp:8545');
run('reverse', 'tcp:8899', 'tcp:8899');

let screen = dump('ui-auth-check-home.xml');
let all = texts(screen).join(' | ');
const hit =
  taps(screen).find((n) => /Profile and settings|Profile|Account|More/i.test(n.label)) ||
  taps(screen).find((n) => /^More/i.test(n.label));
if (hit) {
  tap(hit.x, hit.y);
  sleep(2000);
  screen = dump('ui-auth-check-more.xml');
  all = texts(screen).join(' | ');
  const account = taps(screen).find((n) => /Account|Sign in|Profile|Auvora account/i.test(n.label));
  if (account) {
    tap(account.x, account.y);
    sleep(2500);
    screen = dump('ui-auth-check-account.xml');
    all = texts(screen).join(' | ');
  }
}

const sample = texts(screen).slice(0, 100);
const joined = sample.join(' | ');
const report = {
  sessionExpired: /session has expired|Sign in again/i.test(joined),
  signedInUi:
    (/Signed in|signed in|Email|@|qa@/i.test(joined) &&
      !/Sign in to continue|session has expired/i.test(joined)) ||
    (/Sign out|Log out/i.test(joined) && !/session has expired/i.test(joined)),
  signInCta: !!taps(screen).find(
    (n) => /^Sign [Ii]n/i.test(n.label) || /Sign in again/i.test(n.label),
  ),
  welcome: /Create Account|Welcome to Auvora/i.test(joined),
  vaultHint: /Protected|biometrics|vault|wallet/i.test(joined),
  sample,
};
console.log(JSON.stringify(report, null, 2));
if (!report.signedInUi || report.sessionExpired || report.signInCta) {
  console.log('\nWAIT_FOR_REAUTH — Sign in again on the Samsung with the existing QA account.');
  process.exit(2);
}
console.log('\nAUTH_OK');
process.exit(0);
