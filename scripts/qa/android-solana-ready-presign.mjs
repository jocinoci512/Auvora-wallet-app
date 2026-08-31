#!/usr/bin/env node
/**
 * LOCAL QA — open Solana Send flow to Ready screen. Does NOT tap Sign.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const adb = 'D:\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'R5CW51ZMNLB';
const pkg = 'com.auvora.auvora_wallet.qa';
const artifacts = path.join(root, 'artifacts');
const recipient = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const amount = '0.0001';
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
function taps(xmlPath) {
  const t = fs.readFileSync(xmlPath, 'utf8');
  const out = [];
  for (const m of t.matchAll(/<node\b[^>]*>/g)) {
    const node = m[0];
    const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!bounds) continue;
    const desc = node.match(/content-desc="([^"]*)"/);
    const text = node.match(/\btext="([^"]*)"/);
    const label = ((desc && desc[1]) || (text && text[1]) || '')
      .replace(/&#10;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    if (!label) continue;
    out.push({
      label,
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
  // Swipe inside the send ListView, above the bottom tab bar.
  run('shell', 'input', 'swipe', '540', '1500', '540', '500', '350');
}
function editBounds(xmlPath) {
  const t = fs.readFileSync(xmlPath, 'utf8');
  const m = t.match(/class="[^"]*EditText[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!m) {
    const m2 = t.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="[^"]*EditText[^"]*"/);
    if (!m2) return null;
    return {
      x: (Number(m2[1]) + Number(m2[3])) / 2,
      y: (Number(m2[2]) + Number(m2[4])) / 2,
    };
  }
  return {
    x: (Number(m[1]) + Number(m[3])) / 2,
    y: (Number(m[2]) + Number(m[4])) / 2,
  };
}
function findTap(xml, pred) {
  return taps(xml).find(pred) || null;
}
function mustTap(xml, pred, hint) {
  const hit = findTap(xml, pred);
  if (!hit) throw new Error(`tap not found: ${hint}`);
  tap(hit.x, hit.y);
  return hit.label;
}

const report = {
  lockRequired: false,
  banner: false,
  networkLabel: false,
  localQaLabel: false,
  balanceVisible: false,
  balanceText: '',
  ready: false,
  recipient: false,
  amount: false,
  fee: false,
  feeText: '',
  source: false,
  signButtonPresent: false,
  textsSample: [],
};

run('reverse', 'tcp:4000', 'tcp:4000');
run('reverse', 'tcp:8545', 'tcp:8545');
run('reverse', 'tcp:8899', 'tcp:8899');
run('shell', 'am', 'force-stop', pkg);
sleep(2000);
run('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1');
sleep(16000);

let screen = dump('ui-sol-home.xml');
let all = texts(screen).join(' | ');
report.banner = /LOCAL QA|Local EVM \+ Solana QA|Local Solana QA/i.test(all);
report.localQaLabel = /LOCAL QA/i.test(all);
if (/unlock|enter pin|passcode/i.test(all) && !/Good |Assets|Activity/i.test(all)) {
  report.lockRequired = true;
  console.log(JSON.stringify(report, null, 2));
  console.log('\nUnlock the Auvora wallet on the Samsung.');
  process.exit(0);
}

// Path: Assets → Solana → Send (most reliable; Home Send may be off-screen)
mustTap(screen, (n) => /^Assets/i.test(n.label) || n.label.startsWith('Assets'), 'Assets');
sleep(1800);
screen = dump('ui-sol-assets.xml');
all = texts(screen).join(' | ');
const bal = all.match(/Solana[^\d]*([\d.]+)\s*SOL/i) || all.match(/\b(20(?:\.\d+)?)\s*SOL\b/);
if (bal) {
  report.balanceVisible = true;
  report.balanceText = `${bal[1]} SOL`;
}
mustTap(
  screen,
  (n) => /Solana SOL|S Solana|SOL · Solana|Solana SOL/i.test(n.label),
  'Solana asset row',
);
sleep(2200);
screen = dump('ui-sol-asset-detail.xml');
all = texts(screen).join(' | ');
report.networkLabel = /Auvora Local Solana QA/i.test(all);
report.balanceVisible ||= /20(?:\.\d+)?\s*SOL|\bSOL\b/.test(all);
if (!findTap(screen, (n) => /^Send$/i.test(n.label) || n.label === 'Send')) {
  swipeUp();
  sleep(800);
  screen = dump('ui-sol-asset-detail2.xml');
}
mustTap(screen, (n) => /^Send$/i.test(n.label) || n.label === 'Send', 'Send');
sleep(2500);

screen = dump('ui-sol-send.xml');
all = texts(screen).join(' | ');
report.networkLabel ||= /Auvora Local Solana QA/i.test(all);

// If asset picker still showing, select SOL
if (/Choose asset|Select asset|Ethereum|Bitcoin/i.test(all)) {
  mustTap(
    screen,
    (n) => /SOL|Solana|Local Solana/i.test(n.label) && !/USDC|USDT/.test(n.label),
    'pick SOL',
  );
  sleep(2000);
  screen = dump('ui-sol-send2.xml');
  all = texts(screen).join(' | ');
}

// Recipient step — tap EditText then type address
report.networkLabel ||= /Auvora Local Solana QA/i.test(all);
const edit = editBounds(screen);
if (edit) tap(edit.x, edit.y);
else tap(540, 454);
sleep(600);
run('shell', 'input', 'text', recipient);
sleep(1200);
screen = dump('ui-sol-recipient.xml');
all = texts(screen).join(' | ');
report.recipient = all.includes(recipient) || all.includes(recipient.slice(0, 10));
// Continue may stay disabled until valid address — tap only if clickable semantics present
const cont = findTap(screen, (n) => /^Continue$/i.test(n.label));
if (cont) {
  tap(cont.x, cont.y);
} else {
  tap(540, 2050);
}
sleep(2500);

// Amount
screen = dump('ui-sol-amount.xml');
all = texts(screen).join(' | ');
report.networkLabel ||= /Auvora Local Solana QA/i.test(all);
report.balanceVisible ||= /Available\s+([\d.]+)\s*SOL/i.test(all);
if (/Available\s+([\d.]+)\s*SOL/i.test(all)) {
  report.balanceText = all.match(/Available\s+([\d.]+)\s*SOL/i)[0];
}
const amtEdit = editBounds(screen);
if (amtEdit) tap(amtEdit.x, amtEdit.y);
else tap(540, 700);
sleep(400);
run('shell', 'input', 'text', amount);
sleep(1000);
// Dismiss keyboard so "Review transfer" is reachable in the accessibility tree.
run('shell', 'input', 'keyevent', 'KEYCODE_BACK');
sleep(800);
screen = dump('ui-sol-amount2.xml');
all = texts(screen).join(' | ');
report.amount = /0\.0001|19\.999/.test(all);
if (/Estimated network fee\s+([0-9.]+)\s*SOL/i.test(all)) {
  report.fee = true;
  report.feeText = all.match(/Estimated network fee\s+[0-9.]+\s*SOL[^|]*/i)[0].trim();
}
// Review transfer is often below the fold on the amount step.
for (let i = 0; i < 5; i++) {
  if (findTap(screen, (n) => /review transfer/i.test(n.label))) break;
  swipeUp();
  sleep(700);
  screen = dump(`ui-sol-amount-scroll${i}.xml`);
}
mustTap(screen, (n) => /review transfer/i.test(n.label), 'Review transfer');
sleep(2500);

// Review confirmations → Continue → Ready (never tap Sign)
screen = dump('ui-sol-review.xml');
all = texts(screen).join(' | ');
report.networkLabel ||= /Auvora Local Solana QA/i.test(all);
report.recipient ||= all.includes(recipient) || all.includes(recipient.slice(0, 10));
report.amount ||= /0\.0001/.test(all);
report.source ||= all.includes(sourcePrefix) || /8jFiN4J/i.test(all);

function nodesDetailed(xmlPath) {
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
    const enabled = node.match(/\benabled="(true|false)"/);
    const label = ((desc && desc[1]) || (text && text[1]) || '')
      .replace(/&#10;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    out.push({
      label,
      checked: checked ? checked[1] === 'true' : false,
      checkable: checkable ? checkable[1] === 'true' : false,
      enabled: !enabled || enabled[1] !== 'false',
      x: (Number(bounds[1]) + Number(bounds[3])) / 2,
      y: (Number(bounds[2]) + Number(bounds[4])) / 2,
    });
  }
  return out;
}

const confirmPreds = [
  /I checked the full recipient/i,
  /I confirmed this is Auvora Local Solana QA/i,
  /I confirmed .* is correct/i,
  /I understand this transfer cannot be reversed/i,
];
for (const pred of confirmPreds) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let list = nodesDetailed(screen);
    let hit = list.find((n) => pred.test(n.label));
    if (!hit) {
      swipeUp();
      sleep(600);
      screen = dump('ui-sol-review-cb.xml');
      continue;
    }
    if (hit.checked) break;
    tap(hit.x, hit.y);
    sleep(700);
    screen = dump('ui-sol-review-cb.xml');
    list = nodesDetailed(screen);
    if (list.find((n) => pred.test(n.label) && n.checked)) break;
  }
}

for (let i = 0; i < 4; i++) {
  if (nodesDetailed(screen).find((n) => /^Continue$/i.test(n.label) && n.enabled)) break;
  swipeUp();
  sleep(600);
  screen = dump('ui-sol-review-cont.xml');
}
const contEnabled = nodesDetailed(screen).find((n) => /^Continue$/i.test(n.label) && n.enabled);
if (!contEnabled) {
  report.textsSample = texts(screen).slice(0, 80);
  console.log(JSON.stringify(report, null, 2));
  console.log('\nREVIEW_CONTINUE_DISABLED — checkboxes or session may block Ready.');
  process.exit(0);
}
tap(contEnabled.x, contEnabled.y);
sleep(4000);

for (let i = 0; i < 12; i++) {
  const readyPath = dump(`ui-sol-ready-${i}.xml`);
  const readyTexts = texts(readyPath);
  all = readyTexts.join(' | ');
  report.textsSample = readyTexts.slice(0, 80);
  if (/session has expired|Sign in again/i.test(all)) {
    report.lockRequired = true;
    console.log(JSON.stringify(report, null, 2));
    console.log(
      '\nSession expired — Sign in again on the Samsung (existing QA account). Do not create a new account.',
    );
    process.exit(0);
  }
  // Require authentic Ready CTA — never match "Sign in again"
  const signHit = nodesDetailed(readyPath).find(
    (n) =>
      (/^Sign$/i.test(n.label) ||
        /^Authorize$/i.test(n.label) ||
        /Approve transfer/i.test(n.label)) &&
      !/Sign in/i.test(n.label),
  );
  const readyCopy = /Nothing has been signed|This transfer can continue/i.test(all);
  if (signHit || readyCopy) {
    report.networkLabel ||= /Auvora Local Solana QA/i.test(all);
    report.localQaLabel ||= /LOCAL QA|Local Solana QA|mainnet OFF|MAINNET OFF/i.test(all);
    report.recipient ||= all.includes(recipient) || all.includes(recipient.slice(0, 10));
    report.amount ||= /0\.0001/.test(all);
    report.fee ||= /network fee|fee|QA SOL|0\.0000/i.test(all);
    const feeMatch =
      all.match(/Network fee\s+[0-9.]+\s*SOL[^|]*/i) ||
      all.match(/Estimated network fee\s+[0-9.]+\s*SOL/i);
    if (feeMatch) report.feeText = feeMatch[0].trim();
    report.source ||= all.includes(sourcePrefix) || /8jFiN4J/i.test(all);
    report.signButtonPresent = !!signHit;
    report.ready =
      report.networkLabel &&
      report.amount &&
      report.recipient &&
      (report.signButtonPresent || readyCopy);
    console.log(JSON.stringify(report, null, 2));
    if (report.ready) console.log('\nREADY_SCREEN_REACHED — Sign present but NOT tapped.');
    else console.log('\nREADY_SCREEN_INCOMPLETE — see artifacts/ui-sol-ready-*.xml');
    process.exit(0);
  }
  const next = nodesDetailed(readyPath).find(
    (n) => n.enabled && /^Continue$/i.test(n.label) && !/Sign|Authorize/i.test(n.label),
  );
  if (next) {
    tap(next.x, next.y);
    sleep(3000);
    continue;
  }
  sleep(2000);
}

console.log(JSON.stringify(report, null, 2));
if (!report.ready) console.log('\nREADY_SCREEN_INCOMPLETE — see artifacts/ui-sol-ready-*.xml');
