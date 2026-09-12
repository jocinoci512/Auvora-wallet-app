import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  KycLevel,
  KycSubjectType,
  PrismaService,
  VerificationStatus,
  type Prisma,
  type RiskBand,
} from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  ComplianceEventType,
  ConflictError,
  EVENT_BUS,
  type EventBusPort,
  ForbiddenError,
  NotFoundError,
  PERMISSION_COMPLIANCE_ADMIN,
  PERMISSION_COMPLIANCE_REVIEW,
  UnauthorizedError,
  ValidationError,
} from '../../domain';
import {
  FIELD_ENCRYPTION,
  type FieldEncryptionPort,
} from '../../infrastructure/crypto/field-encryption.adapter';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import {
  ADMIN_EVENT_PUBLISHER,
  type AdminEventPublisherPort,
} from '../../infrastructure/realtime/admin-event-publisher.adapter';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';
import {
  DOCUMENT_VERIFICATION_PROVIDER,
  IDENTITY_VERIFICATION_PROVIDER,
  PEP_PROVIDER,
  SANCTIONS_PROVIDER,
  RISK_SCORING_PROVIDER,
} from '../ports/provider.tokens';
import type {
  DocumentVerificationProvider,
  IdentityVerificationProvider,
  PEPProvider,
  RiskScoringProvider,
  SanctionsProvider,
} from '../../domain';
import type { CommercialWebhookPayload } from '../../infrastructure/providers/commercial-kyc.provider';
import { SecureDocumentStorageService } from '../../infrastructure/storage/secure-document-storage.service';

export interface SubmitKycInput {
  subjectType?: KycSubjectType;
  requestedLevel: KycLevel;
  country?: string;
  nationality?: string;
  legalName?: string;
  dateOfBirth?: string;
  businessName?: string;
  idType?: DocumentType | string;
  idNumber?: string;
  idExpiration?: string;
  frontDocumentId?: string;
  backDocumentId?: string;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(IDENTITY_VERIFICATION_PROVIDER) private readonly identity: IdentityVerificationProvider,
    @Inject(DOCUMENT_VERIFICATION_PROVIDER)
    private readonly documents: DocumentVerificationProvider,
    @Inject(SANCTIONS_PROVIDER) private readonly sanctions: SanctionsProvider,
    @Inject(PEP_PROVIDER) private readonly pep: PEPProvider,
    @Inject(RISK_SCORING_PROVIDER) private readonly riskProvider: RiskScoringProvider,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(ADMIN_EVENT_PUBLISHER) private readonly adminEvents: AdminEventPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
    @Optional()
    @Inject(SecureDocumentStorageService)
    private readonly documentStorage?: SecureDocumentStorageService,
  ) {}

  private async recordAudit(input: {
    action: string;
    actorUserId?: string;
    subjectUserId?: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await (this.prisma as any).complianceAuditRecord?.create({
        data: {
          action: input.action,
          actorUserId: input.actorUserId,
          subjectUserId: input.subjectUserId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          details: (input.details ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`Could not record compliance audit record: ${String(err)}`);
    }
  }

  private async emitAdminKycStatus(input: {
    ownerUserId: string;
    targetId: string;
    status: string;
    reason?: string;
  }): Promise<void> {
    await this.adminEvents.publish({
      type: 'COMPLIANCE_STATUS_CHANGED',
      severity:
        input.status === 'REJECTED' || input.status === 'RENEWAL_REQUIRED' ? 'warning' : 'info',
      userId: input.ownerUserId,
      targetId: input.targetId,
      metadata: {
        status: input.status,
        ...(input.reason ? { customerVisibleReason: input.reason.slice(0, 500) } : {}),
      },
    });
  }

  async getOrCreateProfile(ownerUserId: string) {
    const existing = await this.prisma.kycProfile.findUnique({ where: { ownerUserId } });
    if (existing) return existing;
    return this.prisma.kycProfile.create({
      data: { ownerUserId, subjectType: KycSubjectType.INDIVIDUAL, level: KycLevel.NONE },
    });
  }

  async getProfile(ownerUserId: string, requester: JwtAccessClaims) {
    this.assertSelfOrAdmin(ownerUserId, requester);
    return this.getOrCreateProfile(ownerUserId);
  }

  async submitKyc(ownerUserId: string, input: SubmitKycInput) {
    if (input.requestedLevel === KycLevel.NONE) {
      throw new ValidationError('requestedLevel must be greater than NONE');
    }

    const profile = await this.getOrCreateProfile(ownerUserId);
    if (profile.status === VerificationStatus.APPROVED) {
      throw new ConflictError('Identity verification has already been approved for this account');
    }
    const activeRequests = await this.prisma.verificationRequest.findMany({
      where: {
        ownerUserId,
        status: { in: [VerificationStatus.IN_REVIEW, VerificationStatus.SUBMITTED] },
      },
    });
    if (activeRequests.length > 0) {
      throw new ConflictError('An identity verification request is already in review or submitted');
    }

    const legalName = input.legalName?.trim();
    const metadataToStore: Record<string, unknown> = {
      ...(input.idType ? { idType: input.idType } : {}),
      ...(input.idNumber ? { idNumberEncrypted: this.crypto.encrypt(input.idNumber.trim()) } : {}),
      ...(input.idExpiration ? { idExpiration: input.idExpiration.trim() } : {}),
      ...(input.frontDocumentId ? { frontDocumentId: input.frontDocumentId } : {}),
      ...(input.backDocumentId ? { backDocumentId: input.backDocumentId } : {}),
      kycMode: 'manual_admin_review',
    };

    const request = await this.prisma.verificationRequest.create({
      data: {
        profileId: profile.id,
        ownerUserId,
        requestedLevel: input.requestedLevel,
        status: VerificationStatus.SUBMITTED,
        submittedAt: new Date(),
        metadata: metadataToStore as Prisma.InputJsonValue,
      },
    });

    const docIds = [input.frontDocumentId, input.backDocumentId].filter(Boolean) as string[];
    if (docIds.length > 0) {
      await this.prisma.complianceDocument.updateMany({
        where: { id: { in: docIds }, ownerUserId },
        data: { verificationRequestId: request.id },
      });
    }

    await this.events.publish({
      type: ComplianceEventType.KYCStarted,
      aggregateId: request.id,
      payload: { ownerUserId, requestedLevel: input.requestedLevel },
    });
    await this.emitAdminKycStatus({
      ownerUserId,
      targetId: request.id,
      status: VerificationStatus.SUBMITTED,
    });
    await this.notifications.publishEvent({
      eventType: 'compliance.kyc.submitted',
      aggregateId: request.id,
      payload: { ownerUserId, requestedLevel: input.requestedLevel },
    });
    await this.recordAudit({
      action: 'KYC_SUBMITTED',
      actorUserId: ownerUserId,
      subjectUserId: ownerUserId,
      resourceType: 'VerificationRequest',
      resourceId: request.id,
      details: { requestedLevel: input.requestedLevel, idType: input.idType },
    });

    const identity = await this.identity.verifyIdentity({
      subjectType: input.subjectType ?? KycSubjectType.INDIVIDUAL,
      ownerUserId,
      legalName,
      country: input.country,
      dateOfBirth: input.dateOfBirth,
      businessName: input.businessName,
      level: input.requestedLevel,
    });

    if (identity.status === 'REJECTED') {
      const rejected = await this.prisma.verificationRequest.update({
        where: { id: request.id },
        data: {
          status: VerificationStatus.REJECTED,
          rejectionReason: identity.message ?? 'Identity verification failed',
          providerCode: identity.providerCode,
          providerRef: identity.providerRef,
          completedAt: new Date(),
        },
      });
      await this.prisma.kycProfile.update({
        where: { id: profile.id },
        data: { status: VerificationStatus.REJECTED },
      });
      await this.events.publish({
        type: ComplianceEventType.KYCRejected,
        aggregateId: rejected.id,
        payload: { ownerUserId, reason: rejected.rejectionReason },
      });
      return rejected;
    }

    const displayName = legalName ?? input.businessName ?? ownerUserId;
    const sanctions = await this.sanctions.screen({
      ownerUserId,
      fullName: displayName,
      country: input.country,
      dateOfBirth: input.dateOfBirth,
    });
    for (const hit of sanctions) {
      await this.prisma.sanctionsScreeningResult.create({
        data: {
          profileId: profile.id,
          ownerUserId,
          listSource: hit.listSource ?? 'UNKNOWN',
          matchStatus: hit.matchStatus,
          matchScore: hit.matchScore,
          matchedName: hit.matchedName,
          providerCode: hit.providerCode,
          providerRef: hit.providerRef,
          rawResult: (hit.raw ?? {}) as Prisma.InputJsonValue,
        },
      });
      if (hit.matchStatus === 'POTENTIAL' || hit.matchStatus === 'CONFIRMED') {
        await this.events.publish({
          type: ComplianceEventType.SanctionsMatchFound,
          aggregateId: profile.id,
          payload: { ownerUserId, listSource: hit.listSource, matchStatus: hit.matchStatus },
        });
      }
    }

    const pep = await this.pep.screen({
      ownerUserId,
      fullName: displayName,
      country: input.country,
      dateOfBirth: input.dateOfBirth,
    });
    await this.prisma.pepScreeningResult.create({
      data: {
        profileId: profile.id,
        ownerUserId,
        matchStatus: pep.matchStatus,
        matchScore: pep.matchScore,
        matchedName: pep.matchedName,
        providerCode: pep.providerCode,
        providerRef: pep.providerRef,
        rawResult: (pep.raw ?? {}) as Prisma.InputJsonValue,
      },
    });
    if (pep.matchStatus === 'POTENTIAL' || pep.matchStatus === 'CONFIRMED') {
      await this.events.publish({
        type: ComplianceEventType.PEPMatchFound,
        aggregateId: profile.id,
        payload: { ownerUserId, matchStatus: pep.matchStatus },
      });
    }

    const risk = await this.riskProvider.score({
      ownerUserId,
      factors: {
        country: input.country === 'IR' || input.country === 'KP' ? 90 : 20,
        device: 15,
        behavior: 20,
        velocity: 10,
        transaction: 10,
        wallet: 10,
        blockchain: 10,
        ip: 10,
        account: profile.level === KycLevel.NONE ? 40 : 15,
      },
    });

    await this.prisma.riskScoreRecord.create({
      data: {
        profileId: profile.id,
        ownerUserId,
        score: risk.score,
        band: risk.band as RiskBand,
        factors: risk.factors as Prisma.InputJsonValue,
        providerCode: this.riskProvider.getCode(),
      },
    });
    await this.events.publish({
      type: ComplianceEventType.RiskScoreUpdated,
      aggregateId: profile.id,
      payload: { ownerUserId, score: risk.score, band: risk.band },
    });

    // First-party manual admin review: request status is SUBMITTED for Admin review.
    const updated = await this.prisma.verificationRequest.update({
      where: { id: request.id },
      data: {
        status: VerificationStatus.SUBMITTED,
        providerCode: identity.providerCode,
        providerRef: identity.providerRef,
        completedAt: null,
        reviewedAt: null,
        metadata: {
          ...metadataToStore,
          ...(identity.sessionUrl ? { sessionUrl: identity.sessionUrl } : {}),
          ...(identity.clientSecret ? { clientSecret: identity.clientSecret } : {}),
        } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.kycProfile.update({
      where: { id: profile.id },
      data: {
        subjectType: input.subjectType ?? KycSubjectType.INDIVIDUAL,
        status: VerificationStatus.SUBMITTED,
        country: input.country,
        nationality: input.nationality,
        legalNameEncrypted: legalName ? this.crypto.encrypt(legalName) : undefined,
        dateOfBirthEncrypted: input.dateOfBirth
          ? this.crypto.encrypt(input.dateOfBirth)
          : undefined,
        businessNameEncrypted: input.businessName
          ? this.crypto.encrypt(input.businessName)
          : undefined,
        riskBand: risk.band as RiskBand,
        riskScore: risk.score,
        lastScreenedAt: new Date(),
        metadata: {
          screeningAlerts:
            sanctions.some((s) => s.matchStatus === 'POTENTIAL' || s.matchStatus === 'CONFIRMED') ||
            pep.matchStatus === 'POTENTIAL' ||
            pep.matchStatus === 'CONFIRMED' ||
            risk.band === 'HIGH' ||
            risk.band === 'CRITICAL',
        } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async listDocuments(ownerUserId: string) {
    return this.prisma.complianceDocument.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadDocumentPayload(
    ownerUserId: string,
    input: {
      documentType: DocumentType | string;
      fileBuffer: Buffer;
      fileName?: string;
      requestedContentType?: string;
      side?: 'front' | 'back';
      verificationRequestId?: string;
    },
  ) {
    if (!this.documentStorage) {
      throw new Error('Secure document storage service is not available');
    }

    const validated = this.documentStorage.validateAndSanitizeUpload({
      fileBuffer: input.fileBuffer,
      fileName: input.fileName,
      requestedContentType: input.requestedContentType,
    });

    const profile = await this.getOrCreateProfile(ownerUserId);
    const docId = this.ids.uuid();

    const saved = this.documentStorage.saveEncryptedDocument(
      ownerUserId,
      docId,
      validated.sanitizedBuffer,
    );

    const encryptedStorageKey = this.crypto.encrypt(saved.storageKey);

    const created = await this.prisma.complianceDocument.create({
      data: {
        id: docId,
        profileId: profile.id,
        ownerUserId,
        verificationRequestId: input.verificationRequestId,
        documentType: input.documentType as DocumentType,
        status: DocumentStatus.UPLOADED,
        storageKeyEncrypted: encryptedStorageKey,
        contentType: validated.contentType,
        fileName: validated.safeFileName,
        checksumSha256: saved.checksumSha256,
        metadata: {
          side: input.side ?? 'front',
          fileSizeBytes: saved.fileSizeBytes,
          exifStripped: validated.exifStripped,
        } as Prisma.InputJsonValue,
      },
    });

    await this.recordAudit({
      action: 'DOCUMENT_UPLOADED',
      actorUserId: ownerUserId,
      subjectUserId: ownerUserId,
      resourceType: 'ComplianceDocument',
      resourceId: created.id,
      details: {
        documentType: created.documentType,
        fileSizeBytes: saved.fileSizeBytes,
        side: input.side ?? 'front',
      },
    });

    return {
      id: created.id,
      documentType: created.documentType,
      status: created.status,
      fileName: created.fileName,
      contentType: created.contentType,
      createdAt: created.createdAt,
      metadata: created.metadata,
    };
  }

  async uploadDocument(
    ownerUserId: string,
    input: {
      documentType: string;
      storageKey: string;
      contentType?: string;
      fileName?: string;
      verificationRequestId?: string;
    },
  ) {
    const profile = await this.getOrCreateProfile(ownerUserId);
    const encryptedKey = this.crypto.encrypt(input.storageKey);
    const checksum = this.crypto.hash(input.storageKey);
    const created = await this.prisma.complianceDocument.create({
      data: {
        profileId: profile.id,
        ownerUserId,
        verificationRequestId: input.verificationRequestId,
        documentType: input.documentType as never,
        storageKeyEncrypted: encryptedKey,
        contentType: input.contentType,
        fileName: input.fileName,
        checksumSha256: checksum,
      },
    });

    const verification = await this.documents.verifyDocument({
      documentType: input.documentType,
      ownerUserId,
      storageKey: input.storageKey,
      contentType: input.contentType,
    });

    return this.prisma.complianceDocument.update({
      where: { id: created.id },
      data: {
        status: verification.status as never,
        providerRef: verification.providerRef,
        verifiedAt: verification.status === 'VERIFIED' ? new Date() : null,
      },
    });
  }

  async getDocumentContent(documentId: string, requester: JwtAccessClaims, viewToken?: string) {
    const doc = await this.prisma.complianceDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundError('Compliance document not found');
    }

    let authorized = false;
    if (
      viewToken &&
      this.documentStorage?.verifyViewToken(viewToken, documentId, doc.ownerUserId)
    ) {
      authorized = true;
    } else if (requester.sub === doc.ownerUserId) {
      authorized = true;
    } else {
      this.assertReviewer(requester);
      authorized = true;
    }

    if (!authorized) {
      throw new ForbiddenError('Unauthorized document access');
    }

    if (!this.documentStorage) {
      throw new Error('Document storage service unavailable');
    }

    const storageKey = this.crypto.decrypt(doc.storageKeyEncrypted);
    const decryptedBuffer = this.documentStorage.readAndDecryptDocument(storageKey);

    await this.recordAudit({
      actorUserId: requester.sub,
      action: 'DOCUMENT_VIEWED',
      subjectUserId: doc.ownerUserId,
      resourceType: 'ComplianceDocument',
      resourceId: doc.id,
      details: { documentType: doc.documentType, fileName: doc.fileName },
    });

    return {
      buffer: decryptedBuffer,
      contentType: doc.contentType || 'image/jpeg',
      fileName: doc.fileName || 'document.jpg',
    };
  }

  async getDocumentContentWithToken(documentId: string, viewToken: string) {
    const doc = await this.prisma.complianceDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundError('Compliance document not found');
    }
    if (!this.documentStorage) {
      throw new Error('Document storage service unavailable');
    }
    const isValid = this.documentStorage.verifyViewToken(viewToken, documentId, doc.ownerUserId);
    if (!isValid) {
      throw new ForbiddenError('Invalid or expired document view token');
    }

    const storageKey = this.crypto.decrypt(doc.storageKeyEncrypted);
    const decryptedBuffer = this.documentStorage.readAndDecryptDocument(storageKey);

    await this.recordAudit({
      action: 'DOCUMENT_VIEWED_TOKEN',
      subjectUserId: doc.ownerUserId,
      resourceType: 'ComplianceDocument',
      resourceId: doc.id,
      details: { documentType: doc.documentType, fileName: doc.fileName },
    });

    return {
      buffer: decryptedBuffer,
      contentType: doc.contentType || 'image/jpeg',
      fileName: doc.fileName || 'document.jpg',
    };
  }

  async getDocumentViewToken(documentId: string, reviewer: JwtAccessClaims) {
    this.assertReviewer(reviewer);
    const doc = await this.prisma.complianceDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundError('Compliance document not found');
    }
    if (!this.documentStorage) {
      throw new Error('Document storage service unavailable');
    }
    const token = this.documentStorage.generateViewToken(doc.id, doc.ownerUserId, 300);
    return {
      token,
      documentId: doc.id,
      expiresInSeconds: 300,
    };
  }

  async getLatestVerification(ownerUserId: string) {
    return this.prisma.verificationRequest.findFirst({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Customer snapshot: status + safe metadata only. Never includes internal Admin notes. */
  async getCustomerSnapshot(ownerUserId: string, requester: JwtAccessClaims) {
    const profile = await this.getProfile(ownerUserId, requester);
    const latest = await this.getLatestVerification(ownerUserId);
    const profileMeta =
      profile.metadata && typeof profile.metadata === 'object' && !Array.isArray(profile.metadata)
        ? (profile.metadata as Record<string, unknown>)
        : {};
    const reqMeta =
      latest?.metadata && typeof latest.metadata === 'object' && !Array.isArray(latest.metadata)
        ? (latest.metadata as Record<string, unknown>)
        : {};
    const customerReason =
      (typeof profileMeta.customerVisibleReason === 'string'
        ? profileMeta.customerVisibleReason
        : null) ??
      (typeof reqMeta.customerVisibleReason === 'string' ? reqMeta.customerVisibleReason : null) ??
      latest?.rejectionReason ??
      null;

    return {
      status: profile.status,
      level: profile.level,
      rejectionReason: customerReason,
      metadata: {
        resubmissionRequired:
          profile.status === VerificationStatus.RENEWAL_REQUIRED ||
          latest?.status === VerificationStatus.RENEWAL_REQUIRED ||
          profileMeta.resubmissionRequired === true,
        ...(customerReason ? { customerVisibleReason: customerReason } : {}),
      },
    };
  }

  /** Customer GET: drop internal Admin notes and sensitive raw data from verification metadata. */
  toCustomerVerification<T extends { metadata?: unknown }>(row: T | null): T | null {
    if (!row) return null;
    const metadata = row.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return row;
    const {
      internalAdminNote: _hidden,
      idNumberEncrypted: _hidden2,
      ...safe
    } = metadata as Record<string, unknown>;
    void _hidden;
    void _hidden2;
    return { ...row, metadata: safe };
  }

  async listQueue(status?: VerificationStatus) {
    return this.prisma.verificationRequest.findMany({
      where: status
        ? { status }
        : {
            status: {
              in: [
                VerificationStatus.SUBMITTED,
                VerificationStatus.IN_REVIEW,
                VerificationStatus.RENEWAL_REQUIRED,
                VerificationStatus.REJECTED,
                VerificationStatus.APPROVED,
              ],
            },
          },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    });
  }

  async startReview(requestId: string, reviewer: JwtAccessClaims) {
    this.assertReviewer(reviewer);
    const request = await this.prisma.verificationRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundError('Verification request not found');
    if (request.status === VerificationStatus.APPROVED) {
      throw new ConflictError('Verification request is already approved');
    }
    const updated = await this.prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: VerificationStatus.IN_REVIEW,
        reviewerUserId: reviewer.sub,
        reviewedAt: new Date(),
      },
    });
    await this.prisma.kycProfile.update({
      where: { id: request.profileId },
      data: { status: VerificationStatus.IN_REVIEW },
    });
    await this.recordAudit({
      actorUserId: reviewer.sub,
      action: 'KYC_REVIEW_OPENED',
      subjectUserId: request.ownerUserId,
      resourceType: 'VerificationRequest',
      resourceId: request.id,
    });
    await this.emitAdminKycStatus({
      ownerUserId: request.ownerUserId,
      targetId: updated.id,
      status: VerificationStatus.IN_REVIEW,
    });
    return updated;
  }

  async getReviewDetail(requestId: string, reviewer: JwtAccessClaims) {
    this.assertReviewer(reviewer);
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      include: {
        profile: true,
        documents: true,
      },
    });
    if (!request) throw new NotFoundError('Verification request not found');

    const meta =
      request.metadata && typeof request.metadata === 'object' && !Array.isArray(request.metadata)
        ? (request.metadata as Record<string, unknown>)
        : {};

    let decryptedLegalName: string | null = null;
    let decryptedDob: string | null = null;
    let decryptedIdNumber: string | null = null;

    if (request.profile?.legalNameEncrypted) {
      try {
        decryptedLegalName = this.crypto.decrypt(request.profile.legalNameEncrypted);
      } catch {
        // fallback
      }
    }
    if (request.profile?.dateOfBirthEncrypted) {
      try {
        decryptedDob = this.crypto.decrypt(request.profile.dateOfBirthEncrypted);
      } catch {
        // fallback
      }
    }
    if (typeof meta.idNumberEncrypted === 'string') {
      try {
        decryptedIdNumber = this.crypto.decrypt(meta.idNumberEncrypted);
      } catch {
        // fallback
      }
    }

    const safeDocs = request.documents.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      status: d.status,
      contentType: d.contentType,
      fileName: d.fileName,
      checksumSha256: d.checksumSha256,
      metadata: d.metadata,
      createdAt: d.createdAt,
    }));

    const auditRecords = await this.prisma.complianceAuditRecord.findMany({
      where: { subjectUserId: request.ownerUserId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      id: request.id,
      ownerUserId: request.ownerUserId,
      status: request.status,
      requestedLevel: request.requestedLevel,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      completedAt: request.completedAt,
      rejectionReason: request.rejectionReason,
      country: request.profile?.country ?? null,
      nationality: request.profile?.nationality ?? null,
      legalName: decryptedLegalName,
      dateOfBirth: decryptedDob,
      idType: meta.idType ?? null,
      idNumber: decryptedIdNumber,
      idExpiration: meta.idExpiration ?? null,
      customerVisibleReason: meta.customerVisibleReason ?? request.rejectionReason,
      internalAdminNote: meta.internalAdminNote ?? null,
      documents: safeDocs,
      auditHistory: auditRecords.map((a) => ({
        action: a.action,
        actorUserId: a.actorUserId,
        createdAt: a.createdAt,
        resourceType: a.resourceType,
      })),
    };
  }

  async approve(requestId: string, reviewer: JwtAccessClaims) {
    this.assertReviewer(reviewer);
    const request = await this.prisma.verificationRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundError('Verification request not found');
    if (
      request.status !== VerificationStatus.IN_REVIEW &&
      request.status !== VerificationStatus.SUBMITTED
    ) {
      throw new ConflictError(`Cannot approve request in status ${request.status}`);
    }
    const updated = await this.prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: VerificationStatus.APPROVED,
        reviewerUserId: reviewer.sub,
        reviewedAt: new Date(),
        completedAt: new Date(),
      },
    });
    await this.prisma.kycProfile.update({
      where: { id: request.profileId },
      data: {
        status: VerificationStatus.APPROVED,
        level: request.requestedLevel,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    await this.recordAudit({
      actorUserId: reviewer.sub,
      action: 'KYC_APPROVED',
      subjectUserId: request.ownerUserId,
      resourceType: 'VerificationRequest',
      resourceId: updated.id,
      details: { level: request.requestedLevel },
    });
    await this.events.publish({
      type: ComplianceEventType.KYCCompleted,
      aggregateId: updated.id,
      payload: { ownerUserId: request.ownerUserId, level: request.requestedLevel },
    });
    await this.notifications.publishEvent({
      eventType: 'compliance.kyc.approved',
      aggregateId: updated.id,
      payload: { ownerUserId: request.ownerUserId, level: request.requestedLevel },
    });
    await this.ai.publishEvent({
      eventType: 'compliance.kyc.approved',
      aggregateId: updated.id,
      payload: { ownerUserId: request.ownerUserId, level: request.requestedLevel },
    });
    await this.analytics.publishEvent({
      eventType: 'compliance.kyc.approved',
      domain: 'COMPLIANCE',
      aggregateId: updated.id,
      ownerUserId: request.ownerUserId,
      payload: { ownerUserId: request.ownerUserId, level: request.requestedLevel },
    });
    await this.emitAdminKycStatus({
      ownerUserId: request.ownerUserId,
      targetId: updated.id,
      status: VerificationStatus.APPROVED,
    });
    await this.closeSupersededOpenRequests(request.ownerUserId, updated.id);
    return updated;
  }

  /**
   * Close leftover open verification rows after the profile is already APPROVED.
   * Uses supported CANCELLED status. Does not change the approved profile.
   * Does not notify the customer (these rows are superseded, not a new decision).
   */
  async closeSupersededOpenRequests(ownerUserId: string, exceptRequestId?: string) {
    const profile = await this.prisma.kycProfile.findUnique({ where: { ownerUserId } });
    if (!profile || profile.status !== VerificationStatus.APPROVED) {
      return [];
    }
    const open = await this.prisma.verificationRequest.findMany({
      where: {
        ownerUserId,
        status: {
          in: [
            VerificationStatus.IN_REVIEW,
            VerificationStatus.SUBMITTED,
            VerificationStatus.PENDING_PROVIDER,
          ],
        },
        ...(exceptRequestId ? { id: { not: exceptRequestId } } : {}),
      },
    });
    const closed = [];
    for (const row of open) {
      const prevMeta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      const updated = await this.prisma.verificationRequest.update({
        where: { id: row.id },
        data: {
          status: VerificationStatus.CANCELLED,
          completedAt: new Date(),
          metadata: {
            ...prevMeta,
            superseded: true,
            closedReason: 'Superseded by an approved verification',
          } as Prisma.InputJsonValue,
        },
      });
      closed.push(updated);
      await this.emitAdminKycStatus({
        ownerUserId,
        targetId: updated.id,
        status: VerificationStatus.CANCELLED,
      });
    }
    return closed;
  }

  async reject(
    requestId: string,
    reviewer: JwtAccessClaims,
    reason: string,
    internalNote?: string,
  ) {
    this.assertReviewer(reviewer);
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new ValidationError('A rejection reason is required');
    }
    const internal = internalNote?.trim();
    const request = await this.prisma.verificationRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundError('Verification request not found');
    const prevMeta =
      request.metadata && typeof request.metadata === 'object' && !Array.isArray(request.metadata)
        ? (request.metadata as Record<string, unknown>)
        : {};
    const updated = await this.prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: VerificationStatus.REJECTED,
        reviewerUserId: reviewer.sub,
        rejectionReason: trimmed,
        reviewedAt: new Date(),
        completedAt: new Date(),
        metadata: {
          ...prevMeta,
          customerVisibleReason: trimmed,
          ...(internal ? { internalAdminNote: internal } : {}),
        } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.kycProfile.update({
      where: { id: request.profileId },
      data: { status: VerificationStatus.REJECTED },
    });
    await this.events.publish({
      type: ComplianceEventType.KYCRejected,
      aggregateId: updated.id,
      payload: { ownerUserId: request.ownerUserId, reason: trimmed },
    });
    await this.notifications.publishEvent({
      eventType: 'compliance.kyc.rejected',
      aggregateId: updated.id,
      payload: {
        ownerUserId: request.ownerUserId,
        customerVisibleReason: trimmed,
      },
    });
    await this.emitAdminKycStatus({
      ownerUserId: request.ownerUserId,
      targetId: updated.id,
      status: VerificationStatus.REJECTED,
      reason: trimmed,
    });
    await this.recordAudit({
      actorUserId: reviewer.sub,
      action: 'KYC_REJECTED',
      subjectUserId: request.ownerUserId,
      resourceType: 'VerificationRequest',
      resourceId: updated.id,
      details: { reason: trimmed, internalNotePresent: Boolean(internal) },
    });
    return updated;
  }

  /** Ask the customer to resubmit — stores customer-visible instructions. */
  async requestResubmission(requestId: string, reviewer: JwtAccessClaims, instructions: string) {
    this.assertReviewer(reviewer);
    const trimmed = instructions.trim();
    if (trimmed.length < 3) {
      throw new ValidationError('Resubmission instructions are required');
    }
    const request = await this.prisma.verificationRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundError('Verification request not found');
    const updated = await this.prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: VerificationStatus.RENEWAL_REQUIRED,
        reviewerUserId: reviewer.sub,
        rejectionReason: trimmed,
        reviewedAt: new Date(),
      },
    });
    const profile = await this.prisma.kycProfile.findUnique({ where: { id: request.profileId } });
    const prevMeta =
      profile?.metadata && typeof profile.metadata === 'object' && !Array.isArray(profile.metadata)
        ? (profile.metadata as Record<string, unknown>)
        : {};
    await this.prisma.kycProfile.update({
      where: { id: request.profileId },
      data: {
        status: VerificationStatus.RENEWAL_REQUIRED,
        metadata: {
          ...prevMeta,
          resubmissionRequired: true,
          customerVisibleReason: trimmed,
        } as Prisma.InputJsonValue,
      },
    });
    await this.notifications.publishEvent({
      eventType: 'compliance.kyc.resubmission_required',
      aggregateId: updated.id,
      payload: {
        ownerUserId: request.ownerUserId,
        customerVisibleReason: trimmed,
      },
    });
    await this.emitAdminKycStatus({
      ownerUserId: request.ownerUserId,
      targetId: updated.id,
      status: VerificationStatus.RENEWAL_REQUIRED,
      reason: trimmed,
    });
    await this.recordAudit({
      actorUserId: reviewer.sub,
      action: 'KYC_RESUBMISSION_REQUESTED',
      subjectUserId: request.ownerUserId,
      resourceType: 'VerificationRequest',
      resourceId: updated.id,
      details: { instructions: trimmed },
    });
    return updated;
  }

  /**
   * Processes inbound webhook from commercial identity verification partner.
   * Cryptographically verifies signature, enforces 300s replay window, and provides idempotent deduplication.
   */
  async handleWebhook(
    rawBody: string,
    signatureHeader?: string,
  ): Promise<{ success: boolean; eventId?: string; status?: string; duplicate?: boolean }> {
    if (!signatureHeader) {
      throw new ValidationError('Missing webhook signature header');
    }

    const secret = process.env['KYC_PROVIDER_WEBHOOK_SECRET'];
    if (!secret) {
      this.logger.warn(
        'KYC webhook received but KYC_PROVIDER_WEBHOOK_SECRET is not configured — failing closed',
      );
      throw new UnauthorizedError('Webhook signature verification secret is not configured');
    }

    if (
      !this.identity.verifyWebhookSignature ||
      !this.identity.verifyWebhookSignature(rawBody, signatureHeader, secret)
    ) {
      throw new UnauthorizedError('Invalid webhook signature or expired timestamp');
    }

    let payload: CommercialWebhookPayload;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch {
      throw new ValidationError('Malformed webhook payload');
    }

    if (!payload || typeof payload !== 'object' || !payload.id || !payload.type) {
      throw new ValidationError('Malformed webhook payload: missing event id or type');
    }

    const sessionObj = payload.data?.object;
    if (!sessionObj || !sessionObj.id) {
      // Safely ignore unknown non-identity event types
      return { success: true, eventId: payload.id, status: 'ignored' };
    }

    const sessionId = sessionObj.id;
    const clientRef = sessionObj.client_reference_id;
    const metaOwnerId = sessionObj.metadata?.ownerUserId;
    const ownerUserId = clientRef || metaOwnerId;

    const request = await this.prisma.verificationRequest.findFirst({
      where: {
        OR: [
          { providerRef: sessionId },
          ...(ownerUserId
            ? [
                {
                  ownerUserId,
                  status: {
                    in: [
                      VerificationStatus.PENDING_PROVIDER,
                      VerificationStatus.IN_REVIEW,
                      VerificationStatus.SUBMITTED,
                    ],
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      this.logger.warn(`Webhook received for unknown verification session: ${sessionId}`);
      return { success: true, eventId: payload.id, status: 'unmatched' };
    }

    // Idempotency check: check if this event ID was already processed
    const prevMeta =
      request.metadata && typeof request.metadata === 'object' && !Array.isArray(request.metadata)
        ? (request.metadata as Record<string, unknown>)
        : {};
    const processedEvents = Array.isArray(prevMeta.processedWebhookEventIds)
      ? (prevMeta.processedWebhookEventIds as string[])
      : [];

    if (processedEvents.includes(payload.id)) {
      return { success: true, eventId: payload.id, duplicate: true, status: request.status };
    }

    const updatedEvents = [...processedEvents, payload.id];

    // Map provider event type / status
    const eventType = payload.type;
    const providerStatus = (sessionObj.status || '').toLowerCase();

    if (eventType === 'identity.verification_session.verified' || providerStatus === 'verified') {
      const updated = await this.prisma.verificationRequest.update({
        where: { id: request.id },
        data: {
          status: VerificationStatus.APPROVED,
          providerRef: sessionId,
          completedAt: new Date(),
          metadata: {
            ...prevMeta,
            processedWebhookEventIds: updatedEvents,
            lastWebhookEvent: eventType,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prisma.kycProfile.update({
        where: { id: request.profileId },
        data: {
          status: VerificationStatus.APPROVED,
          level: request.requestedLevel,
          verifiedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });

      await this.events.publish({
        type: ComplianceEventType.KYCCompleted,
        aggregateId: updated.id,
        payload: { ownerUserId: request.ownerUserId, level: request.requestedLevel },
      });
      await this.notifications.publishEvent({
        eventType: 'compliance.kyc.approved',
        aggregateId: updated.id,
        payload: { ownerUserId: request.ownerUserId, level: request.requestedLevel },
      });
      await this.emitAdminKycStatus({
        ownerUserId: request.ownerUserId,
        targetId: updated.id,
        status: VerificationStatus.APPROVED,
      });
      await this.closeSupersededOpenRequests(request.ownerUserId, updated.id);

      return { success: true, eventId: payload.id, status: 'APPROVED' };
    }

    if (
      eventType === 'identity.verification_session.requires_input' ||
      providerStatus === 'requires_input'
    ) {
      const customerReason =
        sessionObj.last_error?.reason ||
        'Document verification requires additional input. Please upload a clear valid government ID.';
      const updated = await this.prisma.verificationRequest.update({
        where: { id: request.id },
        data: {
          status: VerificationStatus.RENEWAL_REQUIRED,
          rejectionReason: customerReason,
          metadata: {
            ...prevMeta,
            customerVisibleReason: customerReason,
            resubmissionRequired: true,
            processedWebhookEventIds: updatedEvents,
            lastWebhookEvent: eventType,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prisma.kycProfile.update({
        where: { id: request.profileId },
        data: {
          status: VerificationStatus.RENEWAL_REQUIRED,
          metadata: {
            resubmissionRequired: true,
            customerVisibleReason: customerReason,
          } as Prisma.InputJsonValue,
        },
      });

      await this.notifications.publishEvent({
        eventType: 'compliance.kyc.resubmission_required',
        aggregateId: updated.id,
        payload: { ownerUserId: request.ownerUserId, customerVisibleReason: customerReason },
      });
      await this.emitAdminKycStatus({
        ownerUserId: request.ownerUserId,
        targetId: updated.id,
        status: VerificationStatus.RENEWAL_REQUIRED,
        reason: customerReason,
      });

      return { success: true, eventId: payload.id, status: 'RENEWAL_REQUIRED' };
    }

    if (eventType === 'identity.verification_session.canceled' || providerStatus === 'canceled') {
      await this.prisma.verificationRequest.update({
        where: { id: request.id },
        data: {
          status: VerificationStatus.CANCELLED,
          metadata: {
            ...prevMeta,
            processedWebhookEventIds: updatedEvents,
            lastWebhookEvent: eventType,
          } as Prisma.InputJsonValue,
        },
      });
      return { success: true, eventId: payload.id, status: 'CANCELLED' };
    }

    if (
      eventType === 'identity.verification_session.processing' ||
      providerStatus === 'processing'
    ) {
      await this.prisma.verificationRequest.update({
        where: { id: request.id },
        data: {
          status: VerificationStatus.IN_REVIEW,
          providerRef: sessionId,
          metadata: {
            ...prevMeta,
            processedWebhookEventIds: updatedEvents,
            lastWebhookEvent: eventType,
          } as Prisma.InputJsonValue,
        },
      });
      return { success: true, eventId: payload.id, status: 'IN_REVIEW' };
    }

    return { success: true, eventId: payload.id, status: request.status };
  }

  async getKycRetentionInventory(ownerUserId: string): Promise<{
    ownerUserId: string;
    profileId?: string;
    status: string;
    canPurgeImmediately: boolean;
    retentionCategory: 'PURGEABLE_IMMEDIATE' | 'STATUTORY_AML_RETENTION_REQUIRED';
    fields: {
      deletableImmediately: string[];
      providerReferences: string[];
      securityAuditRecords: string[];
      potentialLegallyRetainedRecords: string[];
    };
  }> {
    const profile = await this.prisma.kycProfile.findUnique({
      where: { ownerUserId },
      include: { verificationRequests: true, documents: true },
    });

    const isVerifiedOrReview =
      profile?.status === VerificationStatus.APPROVED ||
      profile?.status === VerificationStatus.IN_REVIEW;

    return {
      ownerUserId,
      profileId: profile?.id,
      status: profile?.status ?? 'NONE',
      canPurgeImmediately: !isVerifiedOrReview,
      retentionCategory: isVerifiedOrReview
        ? 'STATUTORY_AML_RETENTION_REQUIRED'
        : 'PURGEABLE_IMMEDIATE',
      fields: {
        deletableImmediately: [
          'kyc_profiles.metadata.temporaryTokens',
          'kyc_profiles.metadata.draftInput',
          'unverified_session_cookies',
        ],
        providerReferences: [
          'verification_requests.provider_ref (Stripe Identity VerificationSession vs_...)',
          'compliance_documents.provider_ref',
          'sanctions_screening_results.provider_ref',
          'pep_screening_results.provider_ref',
        ],
        securityAuditRecords: [
          'compliance_audit_records',
          'compliance_event_logs',
          'verification_requests.metadata.processedWebhookEventIds',
        ],
        potentialLegallyRetainedRecords: [
          'kyc_profiles.legal_name_encrypted (AES-256)',
          'kyc_profiles.date_of_birth_encrypted (AES-256)',
          'kyc_profiles.business_name_encrypted (AES-256)',
          'kyc_profiles.country',
          'kyc_profiles.status',
          'kyc_profiles.level',
          'kyc_profiles.verified_at',
          'sanctions_screening_results.match_status',
          'pep_screening_results.match_status',
          'risk_score_records',
        ],
      },
    };
  }

  async executeAccountDeletionKycHook(ownerUserId: string): Promise<{
    actionTaken: 'PURGED_IMMEDIATELY' | 'RETAINED_PENDING_LEGAL_POLICY';
    ownerUserId: string;
    details: string;
  }> {
    const profile = await this.prisma.kycProfile.findUnique({ where: { ownerUserId } });
    if (!profile) {
      return {
        actionTaken: 'PURGED_IMMEDIATELY',
        ownerUserId,
        details: 'No KYC record found for user; nothing to retain.',
      };
    }

    const isApprovedOrReview =
      profile.status === VerificationStatus.APPROVED ||
      profile.status === VerificationStatus.IN_REVIEW;

    if (!isApprovedOrReview) {
      await this.prisma.kycProfile.delete({ where: { id: profile.id } });
      this.logger.log(`Unverified KYC profile purged for user: ${ownerUserId}`);
      return {
        actionTaken: 'PURGED_IMMEDIATELY',
        ownerUserId,
        details: 'Unverified profile and verification drafts purged immediately.',
      };
    }

    const prevMeta =
      profile.metadata && typeof profile.metadata === 'object' && !Array.isArray(profile.metadata)
        ? (profile.metadata as Record<string, unknown>)
        : {};

    // KYC RETENTION — LEGAL REVIEW REQUIRED. Do not invent a statutory duration.
    await this.prisma.kycProfile.update({
      where: { id: profile.id },
      data: {
        metadata: {
          ...prevMeta,
          accountDeletedAt: new Date().toISOString(),
          statutoryRetentionRequired: true,
          retentionPolicyStatus: 'LEGAL_REVIEW_REQUIRED',
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Verified KYC profile retained pending legal retention policy: user=${ownerUserId}`,
    );

    return {
      actionTaken: 'RETAINED_PENDING_LEGAL_POLICY',
      ownerUserId,
      details:
        'Account deletion registered. Verified identification retained subject to applicable retention requirements; retention duration awaits legal confirmation (LEGAL_REVIEW_REQUIRED).',
    };
  }

  private assertSelfOrAdmin(ownerUserId: string, requester: JwtAccessClaims) {
    if (
      ownerUserId !== requester.sub &&
      !requester.permissions.includes(PERMISSION_COMPLIANCE_ADMIN)
    ) {
      throw new ForbiddenError('Access denied');
    }
  }

  private assertReviewer(requester: JwtAccessClaims) {
    const isSuperAdmin = requester.roles.includes('super_admin');
    const isComplianceAdmin =
      requester.roles.includes('admin') &&
      requester.permissions.includes(PERMISSION_COMPLIANCE_REVIEW);
    if (!isSuperAdmin && !isComplianceAdmin) {
      throw new ForbiddenError('Super admin or authorized compliance review permission required');
    }
  }
}
