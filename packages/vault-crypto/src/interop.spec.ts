import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decryptVaultBundle,
  encryptVaultBundle,
  VAULT_ALGORITHM_ID,
  type EncryptedVaultEnvelope,
} from './index';

type InteropFixture = {
  password: string;
  recoveryPhrase: string;
  ownerUserId: string;
  epoch: number;
  plaintextBundle: {
    version: 1;
    wallets: Array<{ walletId: string; mnemonic: string; label?: string }>;
  };
  envelope: EncryptedVaultEnvelope & { epoch: number };
};

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'interop-vectors.json'), 'utf8'),
) as InteropFixture;

describe('vault-crypto interop', () => {
  const ownerUserId = fixture.ownerUserId;
  const password = fixture.password;
  const recoveryPhrase = fixture.recoveryPhrase;

  it('encrypts a fresh bundle and decrypts with the same password', async () => {
    const envelope = await encryptVaultBundle({
      ownerUserId,
      epoch: 2,
      password,
      recoveryPhrase,
      bundle: fixture.plaintextBundle,
    });

    expect(envelope.algorithmId).toBe(VAULT_ALGORITHM_ID);
    expect(envelope.aad).toBe(`${VAULT_ALGORITHM_ID}|${ownerUserId}|2`);

    const decrypted = await decryptVaultBundle({
      ownerUserId,
      envelope,
      epoch: 2,
      password,
    });

    expect(decrypted.version).toBe(1);
    expect(decrypted.wallets).toHaveLength(1);
    expect(decrypted.wallets[0]?.mnemonic).toBe(recoveryPhrase);
  });

  it('decrypts the Node golden fixture with password', async () => {
    const decrypted = await decryptVaultBundle({
      ownerUserId,
      envelope: fixture.envelope,
      epoch: fixture.epoch,
      password,
    });

    expect(decrypted).toEqual(fixture.plaintextBundle);
  });

  it('decrypts the Node golden fixture with recovery phrase', async () => {
    const decrypted = await decryptVaultBundle({
      ownerUserId,
      envelope: fixture.envelope,
      epoch: fixture.epoch,
      recoveryPhrase,
    });

    expect(decrypted).toEqual(fixture.plaintextBundle);
  });

  it('rejects wrong password', async () => {
    await expect(
      decryptVaultBundle({
        ownerUserId,
        envelope: fixture.envelope,
        epoch: fixture.epoch,
        password: 'WrongPass999!',
      }),
    ).rejects.toThrow(/Unable to decrypt vault/i);
  });

  it('rejects wrong recovery phrase', async () => {
    const wrong = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    await expect(
      decryptVaultBundle({
        ownerUserId,
        envelope: fixture.envelope,
        epoch: fixture.epoch,
        recoveryPhrase: wrong,
      }),
    ).rejects.toThrow();
  });

  it('rejects tampered ciphertext', async () => {
    const tampered: EncryptedVaultEnvelope = {
      ...fixture.envelope,
      ciphertext: Buffer.from(fixture.envelope.ciphertext, 'base64')
        .map((b, i) => (i === 30 ? b ^ 0xff : b))
        .toString('base64'),
    };

    await expect(
      decryptVaultBundle({
        ownerUserId,
        envelope: tampered,
        epoch: fixture.epoch,
        password,
      }),
    ).rejects.toThrow();
  });

  it('rejects wrong AAD / owner', async () => {
    await expect(
      decryptVaultBundle({
        ownerUserId: '99999999-9999-4999-8999-999999999999',
        envelope: fixture.envelope,
        epoch: fixture.epoch,
        password,
      }),
    ).rejects.toThrow();
  });
});
