import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  DocumentVerificationProvider,
  DocumentVerificationRequest,
  DocumentVerificationResult,
  IdentityVerificationProvider,
  IdentityVerificationRequest,
  IdentityVerificationResult,
} from '../../domain';

/**
 * First-party manual admin review KYC provider.
 * Does not depend on any third-party external KYC verification service.
 * Submissions are placed in PENDING/IN_REVIEW state for authorized Auvora Admin review.
 */
@Injectable()
export class ManualAdminKycProvider
  implements IdentityVerificationProvider, DocumentVerificationProvider
{
  private readonly logger = new Logger('ManualAdminKycProvider');

  getCode(): string {
    return 'manual-admin-review';
  }

  async verifyIdentity(input: IdentityVerificationRequest): Promise<IdentityVerificationResult> {
    this.logger.log(
      `First-party KYC submission registered for user ${input.ownerUserId}. Placed into manual Admin review queue.`,
    );
    return {
      providerCode: this.getCode(),
      providerRef: `manual-kyc-${input.ownerUserId.slice(0, 8)}-${Date.now()}`,
      status: 'PENDING',
      message:
        'Identification details submitted directly to Auvora for authorized Admin verification.',
    };
  }

  async verifyDocument(input: DocumentVerificationRequest): Promise<DocumentVerificationResult> {
    this.logger.log(
      `First-party KYC document registered for user ${input.ownerUserId} (${input.documentType}). Stored encrypted for Admin review.`,
    );
    return {
      providerCode: this.getCode(),
      providerRef: `manual-doc-${randomUUID().slice(0, 8)}`,
      status: 'PROCESSING',
      message: 'Document securely encrypted and stored for authorized Admin review.',
    };
  }

  verifyWebhookSignature(_rawBody: string, _signatureHeader: string, _secret?: string): boolean {
    // First-party manual admin review has no external webhooks.
    return false;
  }
}
