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

let screen = dump('ui-h.xml');
let hit = taps(screen).find((n) => /^More Tab/i.test(n.label));
if (!hit) throw new Error('More missing');
tap(hit);
sleep(2000);
screen = dump('ui-m.xml');
console.log('MORE', texts(screen).slice(0, 25));
hit = taps(screen).find((n) => /Auvora account/i.test(n.label));
if (!hit) throw new Error('Auvora account missing: ' + texts(screen).join(' | '));
tap(hit);
sleep(3500);
screen = dump('ui-a.xml');
const sample = texts(screen)
  .slice(0, 50)
  .map((s) => s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***'));
const joined = texts(screen).join(' | ');
console.log(
  JSON.stringify(
    {
      sample,
      hasSignOut: /Sign out/i.test(joined),
      onSignInForm: /Forgot password/i.test(joined),
      vaultSyncRequired: /Sign in is required before encrypted/i.test(joined),
      emailVerified: /Email verified Yes/i.test(joined),
      statusLine: sample.find((s) => /Status/i.test(s)) || null,
    },
    null,
    2,
  ),
);
