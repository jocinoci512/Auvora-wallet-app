#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const adb = 'D:\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'R5CW51ZMNLB';
const run = (...a) => execFileSync(adb, ['-s', serial, ...a], { encoding: 'utf8' }).trim();

run('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
run('pull', '/sdcard/ui.xml', 'artifacts/ui-reauth-home.xml');
const t = fs.readFileSync('artifacts/ui-reauth-home.xml', 'utf8');
const texts = [...t.matchAll(/content-desc="([^"]+)"/g)].map((m) =>
  m[1].replace(/&#10;/g, ' ').replace(/&amp;/g, '&'),
);
const plain = [...t.matchAll(/\btext="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
const all = [...texts, ...plain];
const joined = all.join(' | ');
console.log(all.filter(Boolean).slice(0, 80).join('\n'));
console.log(
  JSON.stringify(
    {
      signedInLikely:
        /Good |Assets|Activity|Portfolio|LOCAL QA/i.test(joined) &&
        !/Create account|Create Account/i.test(joined),
      sessionExpired: /session has expired|Sign in again/i.test(joined),
      unlock: /Unlock|Enter passcode|Enter PIN|Confirm passcode/i.test(joined),
      welcome: /Welcome to Auvora|Create Account/i.test(joined),
      localQa: /LOCAL QA|Local Solana|Local EVM \+ Solana QA/i.test(joined),
      signInScreen: /Sign [Ii]n|Email|Password/i.test(joined) && !/Assets|Activity/i.test(joined),
    },
    null,
    2,
  ),
);
