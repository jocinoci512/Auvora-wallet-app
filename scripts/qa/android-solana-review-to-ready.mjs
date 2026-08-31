#!/usr/bin/env node
/**
 * LOCAL QA — from current Review screen, check confirmations → Continue → Ready.
 * Does NOT tap Sign / biometric / PIN.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const adb = 'D:\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'R5CW51ZMNLB';
const artifacts = path.join(root, 'artifacts');
const recipient = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const sourcePrefix = '8jFiN4Ja';

function run(...args) {
  return execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' }).trim();
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function dump(name) {
  run('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  const dest = path.join(artifacts, name);
  run('pull', '/sdcard/ui.xml', dest);
  return dest;
}
function texts(xmlPath) {
  const t = fs.readFileSync(xmlPath, 'utf8');
  const descs = [...t.matchAll(/content-desc="([^"]+)"/g)].map((m) =>
    m[1].replace(/&#10;/g, ' ').replace(/&amp;/g, '&'),
  );
  const plain = [...t.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
  return [...descs, ...plain];
}
function nodes(xmlPath) {
  const t = fs.readFileSync(xmlPath, 'utf8');
  const out = [];
  for (const m of t.matchAll(/<node\b[^>]*>/g)) {
    const node = m[0];
    const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!bounds) continue;
    const desc = node.match(/content-desc="([^"]*)"/);
    const text = node.match(/\btext="([^"]*)"/);
    const checked = node.match(/\bchecked="(true|false)"/);
    const checkable = node.match(/\bcheckable="(true|false)"/);
    const clickable = node.match(/\bclickable="(true|false)"/);
    const label = ((desc && desc[1]) || (text && text[1]) || '')
      .replace(/&#10;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    out.push({
      label,
      checked: checked ? checked[1] === 'true' : false,
      checkable: checkable ? checkable[1] === 'true' : false,
      clickable: clickable ? clickable[1] === 'true' : false,
      x: (Number(bounds[1]) + Number(bounds[3])) / 2,
      y: (Number(bounds[2]) + Number(bounds[4])) / 2,
    });
  }
  return out;
}
function tap(x, y) {
  run('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
}
function swipeUp() {
  run('shell', 'input', 'swipe', '540', '1500', '540', '500', '350');
}
function find(list, pred) {
  return list.find(pred) || null;
}

let screen = dump('ui-sol-review-resume.xml');
let allNodes = nodes(screen);
let allText = texts(screen).join(' | ');
console.log(
  'on_screen:',
  allText.includes('Step 4 of 8')
    ? 'Review'
    : allText.includes('Step 5')
      ? 'maybe-prepare'
      : 'other',
);
console.log(
  'labels:',
  allNodes
    .filter((n) => n.label)
    .map(
      (n) =>
        `${n.checkable ? '[cb]' : ''}${n.checked ? '*' : ''} ${n.label.slice(0, 70)} @${Math.round(n.y)}`,
    )
    .slice(0, 60),
);

// Ensure we are on Review; if not, report and exit.
if (!/Review|Before you continue|I checked the full recipient/i.test(allText)) {
  // Maybe already past Review
  if (/\bSign\b|Authorize|Ready to sign|Confirm & sign/i.test(allText)) {
    const report = buildReport(allText, allNodes);
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }
  console.error('Not on Review or Ready — abort. Dump: artifacts/ui-sol-review-resume.xml');
  process.exit(1);
}

// Check all confirmation checkboxes (tap unchecked checkable rows / labels)
const confirmPreds = [
  /I checked the full recipient/i,
  /I confirmed this is Auvora Local Solana QA/i,
  /I confirmed .* is correct/i,
];
for (const pred of confirmPreds) {
  for (let attempt = 0; attempt < 4; attempt++) {
    allNodes = nodes(screen);
    let hit =
      find(allNodes, (n) => n.checkable && pred.test(n.label) && !n.checked) ||
      find(allNodes, (n) => pred.test(n.label) && !n.checked);
    if (!hit) {
      // already checked or not visible — try swipe
      if (find(allNodes, (n) => pred.test(n.label) && (n.checked || !n.checkable))) break;
      swipeUp();
      sleep(700);
      screen = dump(`ui-sol-review-cb-${attempt}.xml`);
      continue;
    }
    tap(hit.x, hit.y);
    sleep(600);
    screen = dump(`ui-sol-review-after-cb-${attempt}.xml`);
    allText = texts(screen).join(' | ');
    if (find(nodes(screen), (n) => pred.test(n.label) && n.checked)) break;
  }
}

// Scroll to expose Continue if needed
for (let i = 0; i < 4; i++) {
  allNodes = nodes(screen);
  if (find(allNodes, (n) => /^Continue$/i.test(n.label))) break;
  swipeUp();
  sleep(700);
  screen = dump(`ui-sol-review-scroll${i}.xml`);
}

allNodes = nodes(screen);
const cont = find(allNodes, (n) => /^Continue$/i.test(n.label));
if (!cont) {
  console.error('Continue not found after checkboxes');
  console.log(JSON.stringify({ texts: texts(screen).slice(0, 80) }, null, 2));
  process.exit(1);
}
tap(cont.x, cont.y);
sleep(4000);

// May land on prepare / compliance / ready — poll until Ready or timeout
for (let i = 0; i < 12; i++) {
  screen = dump(`ui-sol-post-review-${i}.xml`);
  allText = texts(screen).join(' | ');
  allNodes = nodes(screen);
  console.log(`post-review[${i}] sample:`, texts(screen).slice(0, 12));

  // Do NOT tap Sign
  if (/\bSign\b|Authorize transfer|Approve transfer|Ready to sign|Confirm & sign/i.test(allText)) {
    const report = buildReport(allText, allNodes);
    console.log(JSON.stringify(report, null, 2));
    if (report.ready) console.log('\nREADY_SCREEN_REACHED — Sign present but NOT tapped.');
    else console.log('\nSIGN_UI_VISIBLE_BUT_CHECKS_INCOMPLETE');
    process.exit(0);
  }

  // Intermediate Continue (e.g. after prepare) — allow if not Sign
  const next = find(
    allNodes,
    (n) =>
      (/^Continue$/i.test(n.label) ||
        /^Next$/i.test(n.label) ||
        /Go to Ready|View Ready/i.test(n.label)) &&
      !/Sign|Authorize|Approve|biometric|PIN/i.test(n.label),
  );
  if (next) {
    tap(next.x, next.y);
    sleep(3000);
    continue;
  }

  // Waiting / preparing
  if (/Preparing|Review ID|Pending|Please wait|Loading/i.test(allText)) {
    sleep(2500);
    continue;
  }

  sleep(1500);
}

const report = buildReport(allText, allNodes);
console.log(JSON.stringify(report, null, 2));
console.log('\nREADY_SCREEN_INCOMPLETE — see last ui-sol-post-review-*.xml');
process.exit(0);

function buildReport(all, list) {
  const feeMatch =
    all.match(/Network fee\s+([0-9.]+)\s*SOL[^|]*/i) ||
    all.match(/Estimated network fee\s+[0-9.]+\s*SOL[^|]*/i) ||
    all.match(/~?\s*[0-9.]+\s*QA SOL/i);
  return {
    ready:
      /Auvora Local Solana QA/i.test(all) &&
      /0\.0001/.test(all) &&
      (/\bSign\b/i.test(all) || /Authorize/i.test(all)),
    networkLabel: /Auvora Local Solana QA/i.test(all),
    localQaLabel: /LOCAL QA|mainnet OFF|MAINNET OFF|Local Solana QA/i.test(all),
    recipient:
      all.includes(recipient) || all.includes(recipient.slice(0, 10)) || /…3DKpqk|3DKpqk/.test(all),
    amount: /0\.0001/.test(all),
    fee: !!feeMatch,
    feeText: feeMatch ? feeMatch[0].trim() : '',
    source: all.includes(sourcePrefix) || /8jFiN4J/i.test(all),
    signButtonPresent: !!find(list, (n) => /\bSign\b|Authorize|Approve transfer/i.test(n.label)),
    textsSample: texts(screen).slice(0, 80),
  };
}
