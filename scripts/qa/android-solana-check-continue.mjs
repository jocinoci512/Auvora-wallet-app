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

function nodes(xmlPath) {
  const t = fs.readFileSync(xmlPath, 'utf8');
  const out = [];
  for (const m of t.matchAll(/<node\b[^>]*>/g)) {
    const n = m[0];
    const bounds = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!bounds) continue;
    const desc = (n.match(/content-desc="([^"]*)"/) || [])[1] || '';
    const text = (n.match(/\btext="([^"]*)"/) || [])[1] || '';
    out.push({
      label: (desc || text).replace(/&#10;/g, ' ').replace(/&amp;/g, '&').trim(),
      checked: (n.match(/\bchecked="(true|false)"/) || [])[1] === 'true',
      checkable: (n.match(/\bcheckable="(true|false)"/) || [])[1] === 'true',
      clickable: (n.match(/\bclickable="(true|false)"/) || [])[1] === 'true',
      enabled: (n.match(/\benabled="(true|false)"/) || [])[1] !== 'false',
      x: (Number(bounds[1]) + Number(bounds[3])) / 2,
      y: (Number(bounds[2]) + Number(bounds[4])) / 2,
      x1: Number(bounds[1]),
      y1: Number(bounds[2]),
      x2: Number(bounds[3]),
      y2: Number(bounds[4]),
    });
  }
  return out;
}

function tap(x, y) {
  run('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
}

function swipeUp() {
  run('shell', 'input', 'swipe', '540', '1600', '540', '700', '300');
}

const preds = [
  /I checked the full recipient/i,
  /I confirmed this is Auvora Local Solana QA/i,
  /I confirmed .* is correct/i,
  /I understand this transfer cannot be reversed/i,
];

let screen = dump('ui-sol-cb-debug.xml');
for (let scroll = 0; scroll < 5; scroll++) {
  const list = nodes(screen);
  console.log(
    '--- dump ---',
    list
      .filter((n) => n.checkable || /I checked|I confirmed|I understand|Continue/i.test(n.label))
      .map((n) => ({
        label: n.label.slice(0, 70),
        checked: n.checked,
        checkable: n.checkable,
        clickable: n.clickable,
        enabled: n.enabled,
        y: Math.round(n.y),
      })),
  );
  const missing = preds.some((p) => !list.some((n) => p.test(n.label)));
  if (!missing) break;
  swipeUp();
  sleep(600);
  screen = dump(`ui-sol-cb-scroll${scroll}.xml`);
}

// Check each box: prefer checkable node; else tap left side of label row
for (const pred of preds) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const list = nodes(screen);
    const hit = list.find((n) => pred.test(n.label));
    if (!hit) {
      swipeUp();
      sleep(500);
      screen = dump('ui-sol-cb-find.xml');
      continue;
    }
    if (hit.checked) {
      console.log('already checked:', hit.label.slice(0, 50));
      break;
    }
    // Tap near leading checkbox (left of tile)
    const tx = hit.checkable ? hit.x : Math.max(80, hit.x1 + 48);
    const ty = hit.y;
    console.log('tapping checkbox:', hit.label.slice(0, 50), 'at', Math.round(tx), Math.round(ty));
    tap(tx, ty);
    sleep(700);
    screen = dump('ui-sol-cb-after.xml');
    const after = nodes(screen).find((n) => pred.test(n.label));
    if (after && after.checked) {
      console.log('checked OK:', after.label.slice(0, 50));
      break;
    }
    // try center of row once more
    tap(hit.x, hit.y);
    sleep(700);
    screen = dump('ui-sol-cb-after2.xml');
    const after2 = nodes(screen).find((n) => pred.test(n.label));
    if (after2 && after2.checked) {
      console.log('checked OK (center):', after2.label.slice(0, 50));
      break;
    }
  }
}

screen = dump('ui-sol-before-continue.xml');
let list = nodes(screen);
console.log(
  'checkbox states:',
  preds.map((p) => {
    const n = list.find((x) => p.test(x.label));
    return n
      ? { label: n.label.slice(0, 40), checked: n.checked, enabledContinue: undefined }
      : 'MISSING';
  }),
);
const cont = list.find((n) => /^Continue$/i.test(n.label));
console.log(
  'Continue:',
  cont ? { enabled: cont.enabled, clickable: cont.clickable, y: Math.round(cont.y) } : null,
);
if (!cont) {
  swipeUp();
  sleep(500);
  screen = dump('ui-sol-before-continue2.xml');
  list = nodes(screen);
}
const cont2 = nodes(screen).find((n) => /^Continue$/i.test(n.label));
if (!cont2) {
  console.error('Continue missing');
  process.exit(1);
}
if (!cont2.enabled) {
  console.error('Continue still disabled — checkboxes not accepted');
  process.exit(2);
}
tap(cont2.x, cont2.y);
console.log('tapped Continue');
sleep(5000);

for (let i = 0; i < 15; i++) {
  screen = dump(`ui-sol-ready-try-${i}.xml`);
  const texts = fs
    .readFileSync(screen, 'utf8')
    .match(/content-desc="([^"]+)"|text="([^"]+)"/g)
    ?.map((s) => s.replace(/^content-desc="|^text="/, '').replace(/"$/, ''))
    .slice(0, 25);
  console.log(`try[${i}]`, texts);
  const all = (texts || []).join(' | ');
  if (
    /\bSign\b|Authorize|Ready to sign|CustomerTransferStatus|Nothing has been signed/i.test(all) ||
    (/Ready/i.test(all) && /Network/i.test(all))
  ) {
    // stop — do not tap Sign
    const ns = nodes(screen);
    const sign = ns.find((n) => /\bSign\b|Authorize transfer|Approve/i.test(n.label));
    console.log(
      JSON.stringify(
        {
          ready: !!sign || /Nothing has been signed|This transfer can continue/i.test(all),
          network: /Auvora Local Solana QA/i.test(all),
          amount: /0\.0001/.test(all),
          recipient: /HAgk14|3DKpqk/.test(all),
          signPresent: !!sign,
          sample: texts,
        },
        null,
        2,
      ),
    );
    if (sign) console.log('\nREADY — Sign visible, NOT tapped.');
    process.exit(0);
  }
  const next = nodes(screen).find(
    (n) =>
      n.enabled &&
      (/^Continue$/i.test(n.label) || /^Next$/i.test(n.label)) &&
      !/Sign|Authorize/i.test(n.label),
  );
  if (next) {
    console.log('intermediate continue');
    tap(next.x, next.y);
    sleep(3000);
    continue;
  }
  sleep(2000);
}
console.log('failed to reach Ready');
process.exit(3);
