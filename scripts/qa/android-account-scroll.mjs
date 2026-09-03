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
    const clickable = (n.match(/\bclickable="(true|false)"/) || [])[1] === 'true';
    const label = ((d && d[1]) || (x && x[1]) || '')
      .replace(/&#10;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    if (!label) continue;
    out.push({
      label,
      clickable,
      x: (Number(b[1]) + Number(b[3])) / 2,
      y: (Number(b[2]) + Number(b[4])) / 2,
    });
  }
  return out;
}

let screen = dump('ui-account-scroll.xml');
for (let i = 0; i < 3; i++) {
  run('shell', 'input', 'swipe', '540', '1600', '540', '700', '300');
  sleep(600);
  screen = dump(`ui-account-scroll${i}.xml`);
}
const sample = texts(screen);
const clickables = taps(screen)
  .filter((n) => n.clickable)
  .map((n) => n.label.slice(0, 90));
console.log(JSON.stringify({ sample: sample.slice(0, 80), clickables }, null, 2));

// Detect usable reauth CTA without tapping Sign out
const reauth = taps(screen).find(
  (n) =>
    n.clickable &&
    (/^Sign [Ii]n$/i.test(n.label) ||
      /Sign in again/i.test(n.label) ||
      /Refresh session|Reconnect|Restore session/i.test(n.label)),
);
console.log('reauthCta:', reauth ? reauth.label : null);
