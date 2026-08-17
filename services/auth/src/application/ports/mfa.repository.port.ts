export interface MfaTotpRecord {
  id: string;
  userId: string;
  secretEncrypted: string;
  confirmedAt: Date | null;
  lastUsedStep: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MFA_TOTP_REPOSITORY = Symbol('MFA_TOTP_REPOSITORY');

export interface MfaTotpRepositoryPort {
  findByUserId(userId: string): Promise<MfaTotpRecord | null>;
  upsertPending(userId: string, secretEncrypted: string): Promise<MfaTotpRecord>;
  confirm(userId: string, lastUsedStep: bigint, confirmedAt: Date): Promise<void>;
  markUsedStep(userId: string, lastUsedStep: bigint): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}

export interface MfaRecoveryRecord {
  id: string;
  userId: string;
  codeHash: string;
  consumedAt: Date | null;
  createdAt: Date;
}

export const MFA_RECOVERY_REPOSITORY = Symbol('MFA_RECOVERY_REPOSITORY');

export interface MfaRecoveryRepositoryPort {
  replaceAll(userId: string, codeHashes: string[]): Promise<void>;
  listActiveByUserId(userId: string): Promise<MfaRecoveryRecord[]>;
  consume(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
