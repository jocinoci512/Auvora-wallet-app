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
export {
  DEVICE_WRAP_ALG,
  generateDeviceRecoveryKeyPair,
  wrapVaultKeyForDevice,
  unwrapVaultKeyForDevice,
  type DeviceKeyPair,
  type DeviceWrappedVaultKey,
} from './device-wrap.js';
