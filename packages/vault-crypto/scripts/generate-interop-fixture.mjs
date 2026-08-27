import { encryptVaultBundle } from '../dist/index.js';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');

const recoveryPhrase =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const password = 'TestPass123!';
const ownerUserId = '11111111-1111-4111-8111-111111111111';
const epoch = 1;
const bundle = {
  version: 1,
  wallets: [
    {
      walletId: 'wallet-interop-1',
      mnemonic: recoveryPhrase,
      label: 'Interop Test Wallet',
    },
  ],
};

const envelope = await encryptVaultBundle({
  ownerUserId,
  epoch,
  password,
  recoveryPhrase,
  bundle,
});

function b64ToHex(b64) {
  return Buffer.from(b64, 'base64').toString('hex');
}

const fixture = {
  description:
    'Dummy BIP39 interop vector (abandon...about). NOT a real user mnemonic. Produced by Node encryptVaultBundle.',
  password,
  recoveryPhrase,
  ownerUserId,
  epoch,
  plaintextBundle: bundle,
  envelope: {
    algorithmId: envelope.algorithmId,
    version: envelope.version,
    epoch: envelope.epoch,
    kdfSalt: envelope.kdfSalt,
    kdfParams: envelope.kdfParams,
    recoveryKdfSalt: envelope.recoveryKdfSalt,
    recoveryKdfParams: envelope.recoveryKdfParams,
    wrappedVaultKey: envelope.wrappedVaultKey,
    wrappedVaultKeyRecovery: envelope.wrappedVaultKeyRecovery,
    ciphertext: envelope.ciphertext,
    aad: envelope.aad,
  },
  fieldsBase64: {
    kdfSalt: envelope.kdfSalt,
    recoveryKdfSalt: envelope.recoveryKdfSalt,
    wrappedVaultKey: envelope.wrappedVaultKey,
    wrappedVaultKeyRecovery: envelope.wrappedVaultKeyRecovery,
    ciphertext: envelope.ciphertext,
  },
  fieldsHex: {
    kdfSalt: b64ToHex(envelope.kdfSalt),
    recoveryKdfSalt: b64ToHex(envelope.recoveryKdfSalt),
    wrappedVaultKey: b64ToHex(envelope.wrappedVaultKey),
    wrappedVaultKeyRecovery: b64ToHex(envelope.wrappedVaultKeyRecovery),
    ciphertext: b64ToHex(envelope.ciphertext),
    aadUtf8: Buffer.from(envelope.aad, 'utf8').toString('hex'),
  },
};

const outDir = join(pkgRoot, 'src', 'fixtures');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'interop-vectors.json');
writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);

const mobileFixtures = join(pkgRoot, '..', '..', 'apps', 'mobile', 'test', 'fixtures');
mkdirSync(mobileFixtures, { recursive: true });
copyFileSync(outPath, join(mobileFixtures, 'interop-vectors.json'));

console.log('Wrote', outPath);
console.log('Copied to apps/mobile/test/fixtures/interop-vectors.json');
console.log('algorithmId', envelope.algorithmId);
console.log('aad', envelope.aad);
