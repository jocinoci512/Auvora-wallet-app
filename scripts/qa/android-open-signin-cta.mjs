#!/usr/bin/env node
/** Open Sign-in CTA if present — never type credentials. */
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
    ...[...t.matchAll(/content-desc="([^"]+)"/g)].map((m) => m[1].replace(/&#10;/g, ' ')),
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
    const label = ((d && d[1]) || (x && x[1]) || '').replace(/&#10;/g, ' ').trim();
    if (!label) continue;
    out.push({ label, x: (Number(b[1]) + Number(b[3])) / 2, y: (Number(b[2]) + Number(b[4])) / 2 });
  }
  return out;
}

let screen = dump('ui-open-signin.xml');
const hit = taps(screen).find((n) => /Sign in again|Sign In|Sign in so this wallet/i.test(n.label));
if (hit) {
  run('shell', 'input', 'tap', String(Math.round(hit.x)), String(Math.round(hit.y)));
  sleep(2500);
  screen = dump('ui-signin-screen.xml');
}
const sample = texts(screen).slice(0, 50);
console.log(JSON.stringify({ opened: !!hit, sample }, null, 2));
