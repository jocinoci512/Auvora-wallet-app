#!/usr/bin/env node
/**
 * LOCAL QA — if Sign In form is already filled, tap Sign In only (no typing).
 * Then verify session and leave on Home.
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
  return [
    ...[...t.matchAll(/content-desc="([^"]+)"/g)].map((m) =>
      m[1].replace(/&#10;/g, ' ').replace(/&amp;/g, '&'),
    ),
    ...[...t.matchAll(/\btext="([^"]+)"/g)].map((m) => m[1]),
  ].filter(Boolean);
}
function nodes(p) {
  const t = fs.readFileSync(p, 'utf8');
  const out = [];
  for (const m of t.matchAll(/<node\b[^>]*>/g)) {
    const n = m[0];
    const b = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!b) continue;
    const d = n.match(/content-desc="([^"]*)"/);
    const x = n.match(/\btext="([^"]*)"/);
    const clickable = (n.match(/\bclickable="(true|false)"/) || [])[1] === 'true';
    const enabled = (n.match(/\benabled="(true|false)"/) || [])[1] !== 'false';
    const label = ((d && d[1]) || (x && x[1]) || '')
      .replace(/&#10;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    if (!label) continue;
    out.push({
      label,
      clickable,
      enabled,
      x: (Number(b[1]) + Number(b[3])) / 2,
      y: (Number(b[2]) + Number(b[4])) / 2,
    });
  }
  return out;
}
function tap(n) {
  run('shell', 'input', 'tap', String(Math.round(n.x)), String(Math.round(n.y)));
}

let screen = dump('ui-signin-submit.xml');
let list = nodes(screen);
let all = texts(screen).join(' | ');

// Prefer Sign-in tab if on Create tab
const signInTab = list.find((n) => /^Sign in$/i.test(n.label) && n.clickable);
if (signInTab && /Create Account/i.test(all) && !/Forgot password/i.test(all)) {
  tap(signInTab);
  sleep(1000);
  screen = dump('ui-signin-tab.xml');
  list = nodes(screen);
  all = texts(screen).join(' | ');
}

const submit = list.find(
  (n) =>
    n.enabled &&
    n.clickable &&
    (/^Sign In$/i.test(n.label) || /^Sign in$/i.test(n.label)) &&
    n.y > 800,
);
if (!submit) {
  console.log(JSON.stringify({ error: 'no_submit', sample: texts(screen).slice(0, 30) }, null, 2));
  process.exit(1);
}
console.log('tapping Sign In at', Math.round(submit.x), Math.round(submit.y));
tap(submit);
sleep(6000);

screen = dump('ui-after-signin.xml');
all = texts(screen).join(' | ');
const redacted = texts(screen)
  .slice(0, 40)
  .map((s) => s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***'));

const signedIn =
  /Sign out/i.test(all) ||
  (/Home Tab|Assets Tab|Good /i.test(all) && !/Forgot password|Create account/i.test(all));
const stillForm = /Forgot password|Create account/i.test(all);
const err = /invalid|incorrect|failed|unable to sign|network/i.test(all);

console.log(
  JSON.stringify(
    {
      signedInLikely: signedIn && !stillForm,
      stillForm,
      errHint: err,
      sample: redacted,
    },
    null,
    2,
  ),
);
process.exit(signedIn && !stillForm ? 0 : 2);
