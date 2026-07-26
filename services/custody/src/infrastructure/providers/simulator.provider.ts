import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  CustodyModelCode,
  CustodyProviderPort,
  DestroyKeyRequest,
  DestroyKeyResult,
  GenerateKeyRequest,
  GenerateKeyResult,
  RotateKeyRequest,
  RotateKeyResult,
  SignPayloadRequest,
  SignPayloadResult,
  VerifySignatureRequest,
  VerifySignatureResult,
} from '../../domain';
import { FIELD_ENCRYPTION, type FieldEncryptionPort } from '../crypto/field-encryption.adapter';
import { generateSimulatedKeyPair, signWithSimulatedKey, verifySimulatedSignature } from '../crypto/keypair.util';

/**
 * Local development/test custody backend. Generates real secp256k1/ed25519 keypairs with
 * node:crypto and stores only field-encrypted material — plaintext private keys never
 * leave this class and are never surfaced through application services or HTTP responses.
 */
@Injectable()
export class SimulatorCustodyProvider implements CustodyProviderPort {
  constructor(@Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort) {}

  getCode(): string {
    return 'local-custody-simulator';
  }

  getModel(): CustodyModelCode {
    return 'SELF';
  }

  async generateKey(input: GenerateKeyRequest): Promise<GenerateKeyResult> {
    const { publicKey, privateKey } = generateSimulatedKeyPair(input.algorithm);
    return {
      providerCode: this.getCode(),
      publicKey,
      materialEncrypted: this.crypto.encrypt(privateKey),
      providerRef: `sim-${randomUUID()}`,
    };
  }

  async sign(input: SignPayloadRequest): Promise<SignPayloadResult> {
    if (!input.materialEncrypted) {
      throw new Error('Signing material unavailable for simulated key');
    }
    const privateKey = this.crypto.decrypt(input.materialEncrypted);
    const signature = signWithSimulatedKey(input.algorithm, privateKey, input.payloadHash);
    return { providerCode: this.getCode(), signature, signatureAlg: `${input.algorithm}-SHA256` };
  }

  async verify(input: VerifySignatureRequest): Promise<VerifySignatureResult> {
    return {
      valid: verifySimulatedSignature(input.algorithm, input.publicKey, input.payloadHash, input.signature),
    };
  }

  async rotate(input: RotateKeyRequest): Promise<RotateKeyResult> {
    const { publicKey, privateKey } = generateSimulatedKeyPair(input.algorithm);
    return {
      providerCode: this.getCode(),
      publicKey,
      materialEncrypted: this.crypto.encrypt(privateKey),
      providerRef: `sim-${randomUUID()}`,
    };
  }

  async destroy(_input: DestroyKeyRequest): Promise<DestroyKeyResult> {
    void _input;
    return { destroyed: true };
  }
}
