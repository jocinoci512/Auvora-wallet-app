/** Versioned envelope identifier — bump when wire format changes. */
export const VAULT_ALGORITHM_ID = 'auvora-vault-v1' as const;

/** Argon2id parameters (OWASP-aligned, client-side KDF). */
export const DEFAULT_KDF_PARAMS = {
  type: 'argon2id' as const,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

export const RECOVERY_KDF_PARAMS = {
  type: 'argon2id' as const,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};
