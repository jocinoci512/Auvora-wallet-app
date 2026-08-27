export { VAULT_ALGORITHM_ID, DEFAULT_KDF_PARAMS, RECOVERY_KDF_PARAMS } from './constants.js';
export {
  assertNoPlaintextSecrets,
  constantTimeEqual,
  decryptVaultBundle,
  encryptVaultBundle,
  rewrapVaultWithNewPassword,
  type EncryptedVaultEnvelope,
  type KdfParams,
  type VaultPlaintextBundle,
  type VaultUploadPayload,
  type VaultWalletEntry,
} from './envelope.js';
