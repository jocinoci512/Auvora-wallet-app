#!/usr/bin/env node
/**
 * Fails a production mobile release if identity / version / API / Mainnet guards break.
 * Safe metadata only — never prints keystore passwords.
 *
 * Usage: node scripts/qa/guard-production-mobile-release.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const identityPath = path.join(REPO, 'apps/mobile/release/production-identity.json');
const pubspecPath = path.join(REPO, 'apps/mobile/pubspec.yaml');
const gradlePath = path.join(REPO, 'apps/mobile/android/app/build.gradle.kts');
const releaseConfigPath = path.join(REPO, 'apps/mobile/lib/release/release_config.dart');
const apiConfigPath = path.join(REPO, 'apps/mobile/lib/account/auvora_api_config.dart');
const gradlePropsPath = path.join(REPO, 'apps/mobile/android/gradle.properties');

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

function read(p) {
  if (!existsSync(p)) {
    fail(`Missing required file: ${path.relative(REPO, p)}`);
    return '';
  }
  return readFileSync(p, 'utf8');
}

const identity = JSON.parse(read(identityPath));
const pubspec = read(pubspecPath);
const gradle = read(gradlePath);
const releaseConfig = read(releaseConfigPath);
const apiConfig = read(apiConfigPath);
const gradleProps = existsSync(gradlePropsPath) ? read(gradlePropsPath) : '';

const versionMatch = pubspec.match(/^version:\s*([^\s]+)/m);
if (!versionMatch) {
  fail('pubspec.yaml missing version:');
} else {
  const raw = versionMatch[1].trim();
  const [name, codeStr] = raw.split('+');
  const code = Number(codeStr);
  ok(`pubspec versionName=${name} versionCode=${code}`);
  const minNext = identity.versioning.nextMinimumVersionCode;
  const currentProd = identity.versioning.currentProductionVersionCode;
  if (!Number.isInteger(code) || code < minNext) {
    fail(
      `versionCode ${code} must be >= ${minNext} (production installed baseline ${currentProd})`,
    );
  }
  if (code <= currentProd) {
    fail(`versionCode ${code} must be strictly greater than production baseline ${currentProd}`);
  }
}

const prodId = identity.android.applicationId;
if (!gradle.includes(`"${prodId}"`) && !gradle.includes(`'${prodId}'`)) {
  fail(`build.gradle.kts must reference production applicationId ${prodId}`);
} else {
  ok(`Gradle references ${prodId}`);
}

if (
  /applicationId\s*=\s*["']com\.auvora\.auvora_wallet\.(qa|staging)["']/.test(gradle) &&
  !gradle.includes('isQaBuild') &&
  !gradle.includes('isStagingBuild')
) {
  fail('Production applicationId appears hard-coded to QA/staging');
}

if (
  /^\s*auvoraQa\s*=\s*true/m.test(gradleProps) ||
  /^\s*auvoraStaging\s*=\s*true/m.test(gradleProps)
) {
  fail('android/gradle.properties permanently enables QA/staging — production package would drift');
} else {
  ok('gradle.properties does not permanently force QA/staging');
}

const expectedSha = String(identity.android.uploadCertificateSha256).toLowerCase();
if (!/^[a-f0-9]{64}$/.test(expectedSha)) {
  fail('production-identity.json uploadCertificateSha256 is malformed');
} else {
  ok(`Upload cert SHA-256 locked (${expectedSha.slice(0, 12)}…)`);
}

if (!apiConfig.includes('https://api.auvorawallet.com')) {
  fail('auvora_api_config.dart must default to https://api.auvorawallet.com');
} else {
  ok('Production API default present');
}

if (/defaultValue:\s*'http:\/\/localhost/.test(apiConfig) && !apiConfig.includes('allowLocalApi')) {
  fail('API config defaults to localhost without QA gate');
}

if (!/liveBroadcastEnabled\s*=\s*false/.test(releaseConfig)) {
  fail('ReleaseConfig.liveBroadcastEnabled must remain false (Mainnet OFF)');
} else {
  ok('Mainnet broadcast kill switch is OFF');
}

for (const flag of [
  'mainnetEthereumEnabled',
  'mainnetBnbEnabled',
  'mainnetPolygonEnabled',
  'mainnetSolanaEnabled',
  'mainnetBitcoinEnabled',
  'mainnetTronEnabled',
]) {
  const re = new RegExp(`${flag}\\s*=\\s*true`);
  if (re.test(releaseConfig)) {
    fail(`ReleaseConfig.${flag} unexpectedly true`);
  }
}

if (process.exitCode) {
  console.error('Production mobile release guard FAILED');
  process.exit(process.exitCode);
}
console.log('Production mobile release guard PASSED');
