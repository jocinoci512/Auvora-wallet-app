#!/usr/bin/env node
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
    out.push({ label, x: (Number(b[1]) + Number(b[3])) / 2, y: (Number(b[2]) + Number(b[4])) / 2 });
  }
  return out;
}

let screen = dump('ui-more2.xml');
const hit = taps(screen).find((n) => /Auvora account/i.test(n.label));
if (!hit) {
  console.log('Auvora account row missing');
  process.exit(1);
}
run('shell', 'input', 'tap', String(Math.round(hit.x)), String(Math.round(hit.y)));
sleep(3000);
screen = dump('ui-auvora-account.xml');
const sample = texts(screen).slice(0, 80);
const joined = sample.join(' | ');
console.log(
  JSON.stringify(
    {
      sample,
      hasEmailField: /Email|email/i.test(joined),
      hasPassword: /Password|password/i.test(joined),
      hasSignIn: /Sign [Ii]n/i.test(joined),
      hasSignOut: /Sign out|Log out/i.test(joined),
      sessionExpired: /session has expired|Sign in again/i.test(joined),
      createAccount: /Create account|Create Account/i.test(joined),
    },
    null,
    2,
  ),
);
console.log(
  '\nSTOP — complete Sign in on the Samsung for the existing QA account. Do not create a new account.',
);
