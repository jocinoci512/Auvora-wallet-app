import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Web browser-envelope uses hash-wasm (browser-only). This contract test asserts
 * field names + algorithmId match packages/vault-crypto (Node source of truth).
 * Full decrypt interop is covered by packages/vault-crypto and Dart mobile tests.
 */
describe('browser-envelope vault contract', () => {
  const browserSource = readFileSync(join(__dirname, 'browser-envelope.ts'), 'utf8');
  const nodeConstants = readFileSync(
    join(__dirname, '../../../../../packages/vault-crypto/src/constants.ts'),
    'utf8',
  );
  const nodeEnvelope = readFileSync(
    join(__dirname, '../../../../../packages/vault-crypto/src/envelope.ts'),
    'utf8',
  );

  it('uses the same algorithm id as @auvora/vault-crypto', () => {
    expect(nodeConstants).toContain("VAULT_ALGORITHM_ID = 'auvora-vault-v1'");
    expect(browserSource).toContain("export const VAULT_ALGORITHM_ID = 'auvora-vault-v1'");
  });

  it('declares the same envelope field names as the Node wire format', () => {
    for (const field of [
      'algorithmId',
      'version',
      'kdfSalt',
      'kdfParams',
      'recoveryKdfSalt',
      'recoveryKdfParams',
      'wrappedVaultKey',
      'wrappedVaultKeyRecovery',
      'ciphertext',
      'aad',
      'epoch',
    ]) {
      expect(browserSource).toContain(field);
      expect(nodeEnvelope).toContain(field);
    }
  });

  it('mirrors Argon2id KDF params from the Node package', () => {
    expect(nodeConstants).toContain('memoryCost: 65536');
    expect(nodeConstants).toContain('timeCost: 3');
    expect(nodeConstants).toContain('parallelism: 4');
    expect(nodeConstants).toContain('hashLength: 32');
    expect(browserSource).toContain('memoryCost: 65536');
    expect(browserSource).toContain('timeCost: 3');
    expect(browserSource).toContain('parallelism: 4');
    expect(browserSource).toContain('hashLength: 32');
  });
});
