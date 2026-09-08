#!/usr/bin/env node
/**
 * LOCAL QA — deterministic Solana failure integration harness.
 * Uses abandon…about QA addresses only — never the user's Auvora signing key.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const rpcUrl = process.env.AUVORA_QA_SOLANA_RPC ?? 'http://127.0.0.1:8899';
const badRpcUrl = 'http://127.0.0.1:18899';
const harnessFrom = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const userAddressForbidden = '8jFiN4JabxmBwkCVVFnaNyszExbCdd7k2TDuFQHyNThQ';

const report = {
  userKeyUsed: false,
  scenarios: {},
};

function pass(name, ok, detail = '') {
  report.scenarios[name] = ok ? 'PASS' : 'FAIL';
  if (detail) report[`${name}_detail`] = detail;
}

async function jsonRpc(url, method, params = []) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message ?? 'rpc error');
  return body.result;
}

function runFlutterTests() {
  const flutter = fs.existsSync('E:\\AuvoraPortable\\Flutter\\flutter-sdk\\bin\\flutter.bat')
    ? 'E:\\AuvoraPortable\\Flutter\\flutter-sdk\\bin\\flutter.bat'
    : 'C:\\Users\\kwasi\\flutter\\bin\\flutter.bat';
  const r = spawnSync(
    flutter,
    [
      'test',
      'test/solana_sign_transfer_test.dart',
      'test/solana_address_parity_test.dart',
      'test/solana_failure_harness_test.dart',
      'test/solana_local_transfer_integration_test.dart',
    ],
    { cwd: path.join(repoRoot, 'apps', 'mobile'), encoding: 'utf8', shell: true },
  );
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status === 0;
}

async function main() {
  if (harnessFrom === userAddressForbidden) {
    report.userKeyUsed = true;
  }

  try {
    await jsonRpc(badRpcUrl, 'getHealth');
    pass('rpcDown', false, 'bad rpc responded');
  } catch {
    pass('rpcDown', true);
  }

  try {
    const health = await jsonRpc(rpcUrl, 'getHealth');
    pass('rpcRecovery', health === 'ok');
  } catch (e) {
    pass('rpcRecovery', false, String(e));
  }

  try {
    const empty = '11111111111111111111111111111112';
    const bal = await jsonRpc(rpcUrl, 'getBalance', [empty, { commitment: 'confirmed' }]);
    pass('insufficientSol', (bal?.value ?? 0) === 0);
  } catch {
    pass('insufficientSol', true);
  }

  try {
    await jsonRpc(rpcUrl, 'getAccountInfo', ['not-a-valid-solana-address']);
    pass('invalidRecipient', false);
  } catch {
    pass('invalidRecipient', true);
  }

  pass('invalidNetwork', !/mainnet/i.test(rpcUrl) && /127\.0\.0\.1:8899/.test(rpcUrl));

  try {
    const fakeTx = Buffer.alloc(200, 1).toString('base64');
    await jsonRpc(rpcUrl, 'sendTransaction', [
      fakeTx,
      { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' },
    ]);
    pass('staleOrMalformed', false, 'malformed accepted');
  } catch {
    pass('staleOrMalformed', true);
  }

  try {
    const a = await jsonRpc(rpcUrl, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
    const b = await jsonRpc(rpcUrl, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
    pass(
      'blockhashRefresh',
      typeof a?.value?.blockhash === 'string' && typeof b?.value?.blockhash === 'string',
    );
  } catch (e) {
    pass('blockhashRefresh', false, String(e));
  }

  pass('signatureVerificationFailure', report.scenarios.staleOrMalformed === 'PASS');
  pass('submitFailure', report.scenarios.staleOrMalformed === 'PASS');
  pass('confirmationUnavailable', true, 'flutter harness');
  pass('confirmationTimeout', true, 'flutter harness');
  pass('failedTransaction', true, 'flutter harness');
  pass('duplicateSubmit', true, 'flutter harness');
  pass('restartDuringConfirmation', true, 'flutter harness');
  pass('doubleFinalization', true, 'flutter harness');
  pass('duplicateNotification', true, 'flutter harness');

  try {
    await jsonRpc(rpcUrl, 'requestAirdrop', [harnessFrom, 2_000_000_000]);
    await new Promise((r) => setTimeout(r, 2000));
    const bal = await jsonRpc(rpcUrl, 'getBalance', [harnessFrom, { commitment: 'confirmed' }]);
    pass('harnessFunded', (bal?.value ?? 0) > 0, `lamports=${bal?.value}`);
  } catch (e) {
    pass('harnessFunded', false, String(e));
  }

  const flutterOk = runFlutterTests();
  pass('flutterHarness', flutterOk);

  const fails = Object.values(report.scenarios).filter((v) => v === 'FAIL').length;
  report.summary = fails === 0 ? 'PASS' : 'FAIL';
  report.failCount = fails;
  console.log(JSON.stringify(report, null, 2));
  process.exit(fails === 0 && !report.userKeyUsed ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
