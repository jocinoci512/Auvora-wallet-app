import { Injectable } from '@nestjs/common';
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
import { ProviderUnavailableError } from '../../domain';
import { verifySimulatedSignature } from '../crypto/keypair.util';

/** Used when no simulator/backend is configured — fails closed for key generation, signing, rotation, and destruction. */
@Injectable()
export class UnavailableCustodyProvider implements CustodyProviderPort {
  getCode(): string {
    return 'unavailable-custody-provider';
  }

  getModel(): CustodyModelCode {
    return 'HOSTED';
  }

  async generateKey(_input: GenerateKeyRequest): Promise<GenerateKeyResult> {
    void _input;
    throw new ProviderUnavailableError('No custody provider configured for key generation');
  }

  async sign(_input: SignPayloadRequest): Promise<SignPayloadResult> {
    void _input;
    throw new ProviderUnavailableError('No custody provider configured for signing');
  }

  async verify(input: VerifySignatureRequest): Promise<VerifySignatureResult> {
    // Verification only requires the public key, so it remains safe to perform even
    // when generation/signing backends are unavailable.
    return {
      valid: verifySimulatedSignature(
        input.algorithm,
        input.publicKey,
        input.payloadHash,
        input.signature,
      ),
    };
  }

  async rotate(_input: RotateKeyRequest): Promise<RotateKeyResult> {
    void _input;
    throw new ProviderUnavailableError('No custody provider configured for key rotation');
  }

  async destroy(_input: DestroyKeyRequest): Promise<DestroyKeyResult> {
    void _input;
    throw new ProviderUnavailableError('No custody provider configured for key destruction');
  }
}
