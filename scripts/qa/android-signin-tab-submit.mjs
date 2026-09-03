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
      clickable: (n.match(/\bclickable="(true|false)"/) || [])[1] === 'true',
      enabled: (n.match(/\benabled="(true|false)"/) || [])[1] !== 'false',
    });
  }
  return out;
}

let screen = dump('ui-acct-now.xml');
let hit = taps(screen).find((n) => /^Sign in$/i.test(n.label));
if (hit) {
  run('shell', 'input', 'tap', String(Math.round(hit.x)), String(Math.round(hit.y)));
  sleep(1200);
  screen = dump('ui-signin-tab-now.xml');
}
const sample = texts(screen)
  .slice(0, 40)
  .map((s) => s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***'));
const joined = texts(screen).join(' | ');
const hasEmail = /@/.test(joined);
const hasPasswordDots = /•{3,}|••••/.test(joined) || texts(screen).some((s) => /^•+$/.test(s));
const submit = taps(screen).find(
  (n) => n.enabled && (/^Sign In$/i.test(n.label) || (n.label === 'Sign in' && n.y > 1000)),
);
console.log(
  JSON.stringify(
    {
      sample,
      hasEmail,
      hasPasswordDots,
      submit: submit
        ? { label: submit.label, y: Math.round(submit.y), enabled: submit.enabled }
        : null,
    },
    null,
    2,
  ),
);

if (hasEmail && hasPasswordDots && submit) {
  console.log('SUBMITTING_PREFILLED_SIGNIN');
  run('shell', 'input', 'tap', String(Math.round(submit.x)), String(Math.round(submit.y)));
  sleep(7000);
  screen = dump('ui-post-submit.xml');
  const after = texts(screen)
    .slice(0, 40)
    .map((s) => s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***'));
  console.log(JSON.stringify({ after }, null, 2));
} else {
  console.log('WAIT_USER_SIGNIN — form not complete; do not type credentials.');
  process.exit(2);
}
