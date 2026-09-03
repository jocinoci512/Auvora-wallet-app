#!/usr/bin/env node
/** Bring Auvora QA to Sign-in form. Never types credentials. */
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
function tap(hit) {
  run('shell', 'input', 'tap', String(Math.round(hit.x)), String(Math.round(hit.y)));
}

run('reverse', 'tcp:4000', 'tcp:4000');
run('reverse', 'tcp:8545', 'tcp:8545');
run('reverse', 'tcp:8899', 'tcp:8899');
run('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1');
sleep(5000);

let screen = dump('ui-bring-home.xml');
for (let i = 0; i < 4; i++) {
  const t = texts(screen).join(' | ');
  if (/Home Tab|More Tab|LOCAL QA/i.test(t)) break;
  const back = taps(screen).find((n) => /^Back$/i.test(n.label) || /^Close$/i.test(n.label));
  if (back) {
    tap(back);
    sleep(800);
    screen = dump(`ui-bring-back${i}.xml`);
  } else break;
}

screen = dump('ui-bring-tabs.xml');
let hit = taps(screen).find((n) => /^More Tab/i.test(n.label));
if (!hit) {
  console.log('NOT_AUVORA', texts(screen).slice(0, 20));
  process.exit(1);
}
tap(hit);
sleep(2000);
screen = dump('ui-bring-more.xml');
hit = taps(screen).find((n) => /Auvora account/i.test(n.label));
if (!hit) {
  console.log('NO_ACCOUNT_ROW', texts(screen).slice(0, 30));
  process.exit(1);
}
tap(hit);
sleep(2500);
screen = dump('ui-bring-account.xml');
hit = taps(screen).find((n) => /^Sign in$/i.test(n.label));
if (hit) {
  tap(hit);
  sleep(1000);
  screen = dump('ui-bring-signin.xml');
}
const sample = texts(screen)
  .slice(0, 25)
  .map((s) => s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***'));
console.log(
  JSON.stringify({ sample, onSignIn: /Sign In|Forgot password/i.test(sample.join(' ')) }, null, 2),
);
