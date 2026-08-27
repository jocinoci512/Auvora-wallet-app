import { VAULT_ALGORITHM_ID } from '@auvora/vault-crypto';
import { ForbiddenError, ValidationError } from '../../domain';
import { EncryptedVaultService, type UpsertVaultInput } from './encrypted-vault.service';

const ownerUserId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';

function buildEnvelope(overrides: Partial<UpsertVaultInput> = {}): UpsertVaultInput {
  return {
    ownerUserId,
    algorithmId: VAULT_ALGORITHM_ID,
    version: 1,
    epoch: 1,
    kdfSalt: 'kdf-salt-aaaaaaaa',
    kdfParams: { type: 'argon2id', memoryCost: 65536 },
    recoveryKdfSalt: 'rec-salt-bbbbbbbb',
    recoveryKdfParams: { type: 'argon2id', memoryCost: 65536 },
    wrappedVaultKey: 'wrapped-vault-key-cccc',
    wrappedVaultKeyRecovery: 'wrapped-recovery-dddd',
    ciphertext: 'ciphertext-eeeeeeee',
    aad: `${VAULT_ALGORITHM_ID}|${ownerUserId}|1`,
    ...overrides,
  };
}

function buildPrisma(existing: { epoch: number } | null = null) {
  return {
    encryptedVaultBlob: {
      findUnique: jest.fn().mockResolvedValue(
        existing
          ? {
              ownerUserId,
              algorithmId: VAULT_ALGORITHM_ID,
              version: 1,
              epoch: existing.epoch,
              kdfSalt: 'kdf-salt-aaaaaaaa',
              kdfParams: {},
              recoveryKdfSalt: 'rec-salt-bbbbbbbb',
              recoveryKdfParams: {},
              wrappedVaultKey: 'wrapped-vault-key-cccc',
              wrappedVaultKeyRecovery: 'wrapped-recovery-dddd',
              ciphertext: 'ciphertext-eeeeeeee',
              aad: `${VAULT_ALGORITHM_ID}|${ownerUserId}|${existing.epoch}`,
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            }
          : null,
      ),
      upsert: jest.fn().mockImplementation(({ create, update }) =>
        Promise.resolve({
          ownerUserId,
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          ...(existing ? { ...create, ...update } : create),
        }),
      ),
    },
    securityAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('EncryptedVaultService', () => {
  describe('IDOR / owner access', () => {
    it('rejects cross-user vault access', () => {
      const service = new EncryptedVaultService(buildPrisma() as never);
      expect(() => service.assertOwnerAccess(otherUserId, ownerUserId)).toThrow(ForbiddenError);
      expect(() => service.assertOwnerAccess(otherUserId, ownerUserId)).toThrow(
        'Vault access denied',
      );
    });

    it('allows the owning user', () => {
      const service = new EncryptedVaultService(buildPrisma() as never);
      expect(() => service.assertOwnerAccess(ownerUserId, ownerUserId)).not.toThrow();
    });
  });

  describe('plaintext rejection', () => {
    it('rejects mnemonic-like plaintext in envelope fields', async () => {
      const prisma = buildPrisma();
      const service = new EncryptedVaultService(prisma as never);
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      await expect(
        service.upsertForOwner(
          buildEnvelope({
            ciphertext: mnemonic,
          }),
        ),
      ).rejects.toThrow(/mnemonic|Plaintext/i);

      expect(prisma.encryptedVaultBlob.upsert).not.toHaveBeenCalled();
    });

    it('rejects forbidden secret field names', async () => {
      const prisma = buildPrisma();
      const service = new EncryptedVaultService(prisma as never);

      // assertNoPlaintextSecrets matches spaced key names (e.g. "private key", "mnemonic").
      const poisoned = {
        ...buildEnvelope(),
        mnemonic: 'should-never-be-accepted',
      } as UpsertVaultInput;

      await expect(service.upsertForOwner(poisoned)).rejects.toThrow(/Forbidden field/i);
      expect(prisma.encryptedVaultBlob.upsert).not.toHaveBeenCalled();
    });
  });

  describe('epoch increment', () => {
    it('rejects updates that do not increase epoch', async () => {
      const prisma = buildPrisma({ epoch: 3 });
      const service = new EncryptedVaultService(prisma as never);

      await expect(
        service.upsertForOwner(
          buildEnvelope({
            epoch: 3,
            aad: `${VAULT_ALGORITHM_ID}|${ownerUserId}|3`,
          }),
        ),
      ).rejects.toThrow(ValidationError);

      await expect(
        service.upsertForOwner(
          buildEnvelope({
            epoch: 2,
            aad: `${VAULT_ALGORITHM_ID}|${ownerUserId}|2`,
          }),
        ),
      ).rejects.toThrow('Vault epoch must increase on update');

      expect(prisma.encryptedVaultBlob.upsert).not.toHaveBeenCalled();
    });

    it('accepts a higher epoch on update', async () => {
      const prisma = buildPrisma({ epoch: 3 });
      const service = new EncryptedVaultService(prisma as never);

      const result = await service.upsertForOwner(
        buildEnvelope({
          epoch: 4,
          aad: `${VAULT_ALGORITHM_ID}|${ownerUserId}|4`,
        }),
      );

      expect(result.epoch).toBe(4);
      expect(prisma.encryptedVaultBlob.upsert).toHaveBeenCalled();
      expect(prisma.securityAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'VAULT_BLOB_UPSERTED',
            actorUserId: ownerUserId,
          }),
        }),
      );
    });
  });
});
