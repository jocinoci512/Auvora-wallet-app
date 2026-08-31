#!/usr/bin/env node
/**
 * LOCAL QA — reopen Auvora QA, verify completed tx Activity + notification dedupe.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const adbPath = 'D:\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'R5CW51ZMNLB';
const pkg = 'com.auvora.auvora_wallet.qa';
const txHash = '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f';
const artifacts = path.join(repoRoot, 'artifacts');

function runAdb(...args) {
  return execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8' }).trim();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function dumpUi(name) {
  runAdb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  const dest = path.join(artifacts, name);
  runAdb('pull', '/sdcard/ui.xml', dest);
  return dest;
}

function extractTexts(xmlPath) {
  const t = fs.readFileSync(xmlPath, 'utf8');
  const descs = [...t.matchAll(/content-desc="([^"]+)"/g)].map((m) =>
    m[1].replace(/&#10;/g, ' ').replace(/&amp;/g, '&'),
  );
  const texts = [...t.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
  return [...descs, ...texts];
}

function tapMap(xmlPath) {
  const t = fs.readFileSync(xmlPath, 'utf8');
  const out = [];
  for (const m of t.matchAll(
    /content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g,
  )) {
    const label = m[1].replace(/&#10;/g, ' ').trim();
    if (!label) continue;
    out.push({
      label,
      x: (Number(m[2]) + Number(m[4])) / 2,
      y: (Number(m[3]) + Number(m[5])) / 2,
    });
  }
  return out;
}

function tap(x, y) {
  runAdb('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
}

const report = {
  device: 'FAIL',
  lockRequired: false,
  completedVisible: false,
  networkLabel: false,
  hashVisible: false,
  blockVisible: false,
  feeVisible: false,
  notificationCount: 0,
  notificationDedupe: false,
};

const devices = runAdb('devices');
if (!devices.includes(`${serial}\tdevice`)) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
report.device = 'CONNECTED';

runAdb('reverse', 'tcp:4000', 'tcp:4000');
runAdb('reverse', 'tcp:8545', 'tcp:8545');
runAdb('shell', 'am', 'force-stop', pkg);
sleep(2000);
runAdb('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1');
sleep(8000);

const home = dumpUi('ui-verify-home.xml');
const homeTexts = extractTexts(home).join(' | ');
if (/unlock|passcode|pin|biometric/i.test(homeTexts) && !/Good morning|Activity/i.test(homeTexts)) {
  report.lockRequired = true;
  console.log(JSON.stringify(report, null, 2));
  console.log('\nUnlock the Auvora wallet on the Samsung.');
  process.exit(0);
}

const activityTap = tapMap(home).find((n) => n.label.startsWith('Activity'));
if (activityTap) tap(activityTap.x, activityTap.y);
sleep(2000);
const activity = dumpUi('ui-verify-activity.xml');
const activityText = extractTexts(activity).join(' | ');
report.completedVisible =
  /Sent[^|]*Completed/.test(activityText) &&
  /0\.0001/.test(activityText) &&
  /Sent&#10;Completed · Auvora Local EVM QA/.test(fs.readFileSync(activity, 'utf8'));
report.networkLabel = activityText.includes('Auvora Local EVM QA');

const sentRow = tapMap(activity).find(
  (n) => n.label.includes('Sent') && n.label.includes('Completed'),
);
if (sentRow) tap(sentRow.x, sentRow.y);
sleep(2000);
const detail = dumpUi('ui-verify-detail.xml');
const detailText = extractTexts(detail).join(' | ');
report.hashVisible = detailText.includes(txHash);
report.blockVisible = detailText.includes('1234');
report.feeVisible = /0\.000021/.test(detailText);
report.networkLabel ||= detailText.includes('Auvora Local EVM QA');

execFileSync('python', [path.join(repoRoot, 'scripts', 'qa', 'pull-flutter-prefs.py')], {
  cwd: repoRoot,
  stdio: 'inherit',
});
const prefs = fs.readFileSync(path.join(artifacts, 'qa-flutter-prefs.xml'), 'utf8');
const notifMatch = prefs.match(/flutter\.auvora_notif_inbox_v1">(.*?)<\/string>/s);
if (notifMatch) {
  const inbox = JSON.parse(
    notifMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#10;/g, '\n'),
  );
  const completed = inbox.filter(
    (n) =>
      String(n.title ?? '').toLowerCase() === 'transaction completed' ||
      String(n.id ?? '').startsWith('tx-completed-'),
  );
  report.notificationCount = completed.length;
  report.notificationDedupe = completed.length <= 1;
}

console.log(JSON.stringify(report, null, 2));
