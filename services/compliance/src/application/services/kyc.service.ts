import { Inject, Injectable } from '@nestjs/common';
import {
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
  ValidationError,
} from '../../domain';
import { FIELD_ENCRYPTION, type FieldEncryptionPort } from '../../infrastructure/crypto/field-encryption.adapter';
import {
  AI_PUBLISHER,
  type AiPublisherPort,
} from '../../infrastructure/ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
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

export interface SubmitKycInput {
  subjectType?: KycSubjectType;
  requestedLevel: KycLevel;
  country?: string;
  nationality?: string;
  legalName?: string;
  dateOfBirth?: string;
  businessName?: string;
}

@Injectable()
export class KycService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(IDENTITY_VERIFICATION_PROVIDER) private readonly identity: IdentityVerificationProvider,
    @Inject(DOCUMENT_VERIFICATION_PROVIDER) private readonly documents: DocumentVerificationProvider,
    @Inject(SANCTIONS_PROVIDER) private readonly sanctions: SanctionsProvider,
    @Inject(PEP_PROVIDER) private readonly pep: PEPProvider,
    @Inject(RISK_SCORING_PROVIDER) private readonly riskProvider: RiskScoringProvider,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
  ) {}

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
    const legalName = input.legalName?.trim();
    const request = await this.prisma.verificationRequest.create({
      data: {
        profileId: profile.id,
        ownerUserId,
        requestedLevel: input.requestedLevel,
        status: VerificationStatus.PENDING_PROVIDER,
        submittedAt: new Date(),
      },
    });

    await this.events.publish({
      type: ComplianceEventType.KYCStarted,
      aggregateId: request.id,
      payload: { ownerUserId, requestedLevel: input.requestedLevel },
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

    const needsReview =
      sanctions.some((s) => s.matchStatus === 'POTENTIAL' || s.matchStatus === 'CONFIRMED') ||
      pep.matchStatus === 'POTENTIAL' ||
      pep.matchStatus === 'CONFIRMED' ||
      risk.band === 'HIGH' ||
      risk.band === 'CRITICAL';

    const finalStatus = needsReview ? VerificationStatus.IN_REVIEW : VerificationStatus.APPROVED;
    const updated = await this.prisma.verificationRequest.update({
      where: { id: request.id },
      data: {
        status: finalStatus,
        providerCode: identity.providerCode,
        providerRef: identity.providerRef,
        completedAt: needsReview ? null : new Date(),
        reviewedAt: needsReview ? null : new Date(),
      },
    });

    await this.prisma.kycProfile.update({
      where: { id: profile.id },
      data: {
        subjectType: input.subjectType ?? KycSubjectType.INDIVIDUAL,
        status: finalStatus,
        level: needsReview ? profile.level : input.requestedLevel,
        country: input.country,
        nationality: input.nationality,
        legalNameEncrypted: legalName ? this.crypto.encrypt(legalName) : undefined,
        dateOfBirthEncrypted: input.dateOfBirth ? this.crypto.encrypt(input.dateOfBirth) : undefined,
        businessNameEncrypted: input.businessName ? this.crypto.encrypt(input.businessName) : undefined,
        riskBand: risk.band as RiskBand,
        riskScore: risk.score,
        verifiedAt: needsReview ? undefined : new Date(),
        expiresAt: needsReview ? undefined : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        lastScreenedAt: new Date(),
      },
    });

    if (!needsReview) {
      await this.events.publish({
        type: ComplianceEventType.KYCCompleted,
        aggregateId: updated.id,
        payload: { ownerUserId, level: input.requestedLevel },
      });
    }

    return updated;
  }

  async listDocuments(ownerUserId: string) {
    return this.prisma.complianceDocument.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
    });
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

  async getLatestVerification(ownerUserId: string) {
    return this.prisma.verificationRequest.findFirst({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listQueue(status?: VerificationStatus) {
    return this.prisma.verificationRequest.findMany({
      where: status ? { status } : { status: { in: [VerificationStatus.IN_REVIEW, VerificationStatus.SUBMITTED] } },
      orderBy: { submittedAt: 'asc' },
      take: 100,
    });
  }

  async approve(requestId: string, reviewer: JwtAccessClaims) {
    this.assertReviewer(reviewer);
    const request = await this.prisma.verificationRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundError('Verification request not found');
    if (request.status !== VerificationStatus.IN_REVIEW && request.status !== VerificationStatus.SUBMITTED) {
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
    return updated;
  }

  async reject(requestId: string, reviewer: JwtAccessClaims, reason: string) {
    this.assertReviewer(reviewer);
    const request = await this.prisma.verificationRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundError('Verification request not found');
    const updated = await this.prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: VerificationStatus.REJECTED,
        reviewerUserId: reviewer.sub,
        rejectionReason: reason,
        reviewedAt: new Date(),
        completedAt: new Date(),
      },
    });
    await this.prisma.kycProfile.update({
      where: { id: request.profileId },
      data: { status: VerificationStatus.REJECTED },
    });
    await this.events.publish({
      type: ComplianceEventType.KYCRejected,
      aggregateId: updated.id,
      payload: { ownerUserId: request.ownerUserId, reason },
    });
    return updated;
  }

  private assertSelfOrAdmin(ownerUserId: string, requester: JwtAccessClaims) {
    if (ownerUserId !== requester.sub && !requester.permissions.includes(PERMISSION_COMPLIANCE_ADMIN)) {
      throw new ForbiddenError('Access denied');
    }
  }

  private assertReviewer(requester: JwtAccessClaims) {
    if (
      !requester.permissions.includes(PERMISSION_COMPLIANCE_REVIEW) &&
      !requester.permissions.includes(PERMISSION_COMPLIANCE_ADMIN)
    ) {
      throw new ForbiddenError('Review permission required');
    }
  }
}
