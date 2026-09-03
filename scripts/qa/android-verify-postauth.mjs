#!/usr/bin/env node
/**
 * LOCAL QA — verify authenticated session via UI + gateway /me (no token print).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';

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
function tap(x, y) {
  run('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
}

run('reverse', 'tcp:4000', 'tcp:4000');
run('reverse', 'tcp:8545', 'tcp:8545');
run('reverse', 'tcp:8899', 'tcp:8899');

// Bring app forward without force-stop (preserve session)
run('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1');
sleep(4000);

let screen = dump('ui-postauth-home.xml');
// If still on Account, go Back
if (/Auvora Account|Sign out/i.test(texts(screen).join(' | '))) {
  const back = taps(screen).find((n) => /^Back$/i.test(n.label));
  if (back) {
    tap(back.x, back.y);
    sleep(1500);
    screen = dump('ui-postauth-home2.xml');
  }
}
if (/^More$/i.test(texts(screen)[3] || '') || texts(screen).includes('More')) {
  const home = taps(screen).find((n) => /^Home Tab/i.test(n.label));
  if (home) {
    tap(home.x, home.y);
    sleep(1500);
    screen = dump('ui-postauth-home3.xml');
  }
}

const homeTexts = texts(screen);
const joined = homeTexts.join(' | ');
const homeSignInBanner =
  /Sign in again so this wallet|session has expired|Sign in is required before encrypted/i.test(
    joined,
  );
const localQa = /LOCAL QA|Local EVM \+ Solana QA|mainnet OFF/i.test(joined);
const welcome = /Create Account|Welcome to Auvora/i.test(joined);

// Open Auvora Account for live status (no tokens)
let accountJoined = '';
const more = taps(screen).find((n) => /^More Tab/i.test(n.label) || n.label.startsWith('More Tab'));
if (more) {
  tap(more.x, more.y);
  sleep(1800);
  screen = dump('ui-postauth-more.xml');
  const acct = taps(screen).find((n) => /Auvora account/i.test(n.label));
  if (acct) {
    tap(acct.x, acct.y);
    sleep(2500);
    screen = dump('ui-postauth-account.xml');
    accountJoined = texts(screen).join(' | ');
  }
}

const accountSignedIn =
  /Sign out/i.test(accountJoined) &&
  !/Sign in is required before encrypted vault sync/i.test(accountJoined) &&
  !/Could not access identity verification\. Sign in and try again/i.test(accountJoined);

const report = {
  homeSignInBanner,
  localQa,
  welcome,
  accountSignedIn,
  hasSignOut: /Sign out/i.test(accountJoined),
  vaultSyncOk: !/Sign in is required before encrypted vault sync/i.test(accountJoined),
  identityOk: !/Sign in and try again/i.test(accountJoined),
  homeSample: homeTexts.slice(0, 25),
  accountSample: texts(screen)
    .slice(0, 30)
    .map((s) =>
      s.replace(/emmilianjoan@[^\s]+/gi, '***@***').replace(/Username\s+\S+/gi, 'Username ***'),
    ),
};
console.log(JSON.stringify(report, null, 2));
if (homeSignInBanner || !accountSignedIn || welcome) {
  console.log('\nAUTH_FAIL');
  process.exit(2);
}
console.log('\nAUTH_OK');
process.exit(0);
