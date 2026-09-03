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
    const clickable = (n.match(/\bclickable="(true|false)"/) || [])[1] === 'true';
    const label = ((d && d[1]) || (x && x[1]) || '').replace(/&#10;/g, ' ').trim();
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
function mustTap(screen, pred, hint) {
  const hit = taps(screen).find(pred);
  if (!hit) throw new Error('missing: ' + hint);
  run('shell', 'input', 'tap', String(Math.round(hit.x)), String(Math.round(hit.y)));
  return hit.label;
}

// More tab
let screen = dump('ui-nav-home.xml');
mustTap(screen, (n) => /^More Tab/i.test(n.label) || n.label.startsWith('More'), 'More');
sleep(2000);
screen = dump('ui-nav-more.xml');
console.log('MORE:', texts(screen).slice(0, 40));
const accountish = taps(screen).find((n) =>
  /Account|Sign in|Auvora account|Profile/i.test(n.label),
);
if (accountish) {
  run('shell', 'input', 'tap', String(Math.round(accountish.x)), String(Math.round(accountish.y)));
  sleep(2500);
  screen = dump('ui-nav-account.xml');
}
console.log('ACCOUNT:', texts(screen).slice(0, 60));
console.log(
  'clickables:',
  taps(screen)
    .filter((n) => n.clickable)
    .map((n) => n.label.slice(0, 70)),
);
