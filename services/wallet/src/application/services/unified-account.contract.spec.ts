import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encryptVaultBundle } from '@auvora/vault-crypto';

describe('unified account cross-platform contract', () => {
  it('documents shared vault algorithm id across mobile, web, and server', () => {
    const mobile = readFileSync(
      join(__dirname, '../../../../../apps/mobile/lib/account/vault_crypto.dart'),
      'utf8',
    );
    const web = readFileSync(
      join(__dirname, '../../../../../apps/web/src/lib/vault/browser-envelope.ts'),
      'utf8',
    );
    const server = readFileSync(
      join(__dirname, '../../../../../packages/vault-crypto/src/constants.ts'),
      'utf8',
    );
    expect(mobile).toContain('auvora-vault-v1');
    expect(web).toContain('auvora-vault-v1');
    expect(server).toContain('auvora-vault-v1');
  });

  it('same password decrypts vault envelope produced by shared crypto package', async () => {
    const ownerUserId = '22222222-2222-4222-8222-222222222222';
    const phrase =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const uploaded = await encryptVaultBundle({
      ownerUserId,
      epoch: 1,
      password: 'UnifiedPass123!',
      recoveryPhrase: phrase,
      bundle: {
        version: 1,
        wallets: [{ walletId: 'primary', mnemonic: phrase, label: 'Primary' }],
      },
    });
    expect(uploaded.aad).toContain(ownerUserId);
    expect(uploaded.algorithmId).toBe('auvora-vault-v1');
  });
});
