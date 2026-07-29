export type CustodyModelCode = 'SELF' | 'HOSTED' | 'SHARED' | 'INSTITUTIONAL' | 'MPC' | 'HSM';

export type KeyAlgorithmCode =
  'SECP256K1' | 'ED25519' | 'BITCOIN_SECP256K1' | 'ETHEREUM_SECP256K1' | 'FUTURE_PQ';

export interface GenerateKeyRequest {
  ownerUserId: string;
  algorithm: KeyAlgorithmCode;
  custodyModel: CustodyModelCode;
  label?: string;
}

export interface GenerateKeyResult {
  providerCode: string;
  publicKey: string;
  materialEncrypted?: string;
  providerRef?: string;
}

export interface SignPayloadRequest {
  keyId: string;
  publicKey: string;
  materialEncrypted?: string;
  providerRef?: string;
  algorithm: KeyAlgorithmCode;
  payloadHash: string;
}

export interface SignPayloadResult {
  providerCode: string;
  signature: string;
  signatureAlg: string;
}

export interface VerifySignatureRequest {
  publicKey: string;
  algorithm: KeyAlgorithmCode;
  payloadHash: string;
  signature: string;
}

export interface VerifySignatureResult {
  valid: boolean;
}

export interface RotateKeyRequest {
  keyId: string;
  algorithm: KeyAlgorithmCode;
  custodyModel: CustodyModelCode;
  previousProviderRef?: string;
}

export interface RotateKeyResult {
  providerCode: string;
  publicKey: string;
  materialEncrypted?: string;
  providerRef?: string;
}

export interface DestroyKeyRequest {
  keyId: string;
  providerRef?: string;
  materialEncrypted?: string;
}

export interface DestroyKeyResult {
  destroyed: boolean;
}

/** Strategy interface implemented by each custody backend (self-custody simulator, hosted HSM/MPC, etc). */
export interface CustodyProviderPort {
  getCode(): string;
  getModel(): CustodyModelCode;
  generateKey(input: GenerateKeyRequest): Promise<GenerateKeyResult>;
  sign(input: SignPayloadRequest): Promise<SignPayloadResult>;
  verify(input: VerifySignatureRequest): Promise<VerifySignatureResult>;
  rotate(input: RotateKeyRequest): Promise<RotateKeyResult>;
  destroy(input: DestroyKeyRequest): Promise<DestroyKeyResult>;
}

export interface CustodyProviderRegistryPort {
  resolve(custodyModel: CustodyModelCode): CustodyProviderPort;
}
