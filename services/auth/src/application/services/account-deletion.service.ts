import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService, VerificationStatus, type Prisma } from '@auvora/database';

export type AccountDeletionDataSummary = {
  vaultPurged: boolean;
  vaultRecoveryRequestsPurged: number;
  mfaCleared: boolean;
  notificationPreferencesDeleted: boolean;
  kycAction: 'PURGED_IMMEDIATELY' | 'RETAINED_PENDING_LEGAL_POLICY' | 'NONE';
};

/**
 * Eligible Auvora-controlled data purge for customer self-deletion.
 * Does not touch public blockchain records. KYC retention duration is never invented.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async purgeEligibleCloudData(ownerUserId: string): Promise<AccountDeletionDataSummary> {
    const vault = await this.prisma.encryptedVaultBlob.deleteMany({
      where: { ownerUserId },
    });

    const recovery = await this.prisma.vaultDeviceRecoveryRequest.deleteMany({
      where: { ownerUserId },
    });

    await this.prisma.mfaTotpCredential.deleteMany({ where: { userId: ownerUserId } });
    await this.prisma.mfaRecoveryCode.deleteMany({ where: { userId: ownerUserId } });
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId: ownerUserId } });
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: ownerUserId } });

    const prefs = await this.prisma.notificationPreference.deleteMany({
      where: { ownerUserId },
    });

    const kycAction = await this.applyKycDeletionPolicy(ownerUserId);

    this.logger.log(
      `Account deletion purge complete user=${ownerUserId} vault=${vault.count} recovery=${recovery.count} kyc=${kycAction}`,
    );

    return {
      vaultPurged: vault.count > 0,
      vaultRecoveryRequestsPurged: recovery.count,
      mfaCleared: true,
      notificationPreferencesDeleted: prefs.count > 0,
      kycAction,
    };
  }

  private async applyKycDeletionPolicy(
    ownerUserId: string,
  ): Promise<'PURGED_IMMEDIATELY' | 'RETAINED_PENDING_LEGAL_POLICY' | 'NONE'> {
    const profile = await this.prisma.kycProfile.findUnique({ where: { ownerUserId } });
    if (!profile) return 'NONE';

    const retain =
      profile.status === VerificationStatus.APPROVED ||
      profile.status === VerificationStatus.IN_REVIEW;

    if (!retain) {
      await this.prisma.kycProfile.delete({ where: { id: profile.id } });
      return 'PURGED_IMMEDIATELY';
    }

    const prevMeta =
      profile.metadata && typeof profile.metadata === 'object' && !Array.isArray(profile.metadata)
        ? (profile.metadata as Record<string, unknown>)
        : {};

    // Do not invent a statutory retention duration. Legal must confirm policy.
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

    return 'RETAINED_PENDING_LEGAL_POLICY';
  }
}
