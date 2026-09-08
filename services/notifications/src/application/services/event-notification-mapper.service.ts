import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type NotificationCategory,
  NotificationChannel,
  type NotificationPriority,
  PrismaService,
} from '@auvora/database';
import { NotificationService } from './notification.service';

export type DomainEventInput = {
  eventType: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  correlationId?: string;
};

type MappedNotification = {
  templateCode: string;
  category: NotificationCategory;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  dedupeKey: string;
  variables: Record<string, unknown>;
};

@Injectable()
export class EventNotificationMapperService {
  private readonly logger = new Logger(EventNotificationMapperService.name);

  constructor(
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async mapAndEnqueue(input: DomainEventInput): Promise<number> {
    const mapped = this.resolveMapping(input);
    if (!mapped) return 0;

    const ownerUserId = this.readOwnerUserId(input.payload);
    if (!ownerUserId) {
      this.logger.debug(`Event ${input.eventType} skipped — no ownerUserId in payload`);
      return 0;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { email: true, firstName: true, username: true },
    });
    if (!user?.email) return 0;

    const recipient = user.email;
    const name = user.firstName ?? user.username;
    const variables = { name, ...mapped.variables };

    let sent = 0;
    for (const channel of mapped.channels) {
      await this.notifications.send({
        ownerUserId,
        templateCode: mapped.templateCode,
        category: mapped.category,
        channel,
        priority: mapped.priority,
        recipient: channel === NotificationChannel.IN_APP ? ownerUserId : recipient,
        variables,
        dedupeKey: `${mapped.dedupeKey}:${channel}`,
        correlationId: input.correlationId,
        sourceEventType: input.eventType,
        sourceEventId: input.aggregateId,
        metadata: { eventType: input.eventType },
      });
      sent += 1;
    }
    return sent;
  }

  private readOwnerUserId(payload: Record<string, unknown>): string | null {
    const raw = payload.ownerUserId ?? payload.userId;
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  }

  private resolveMapping(input: DomainEventInput): MappedNotification | null {
    const p = input.payload;
    const id = input.aggregateId ?? 'unknown';

    switch (input.eventType) {
      case 'auth.account.created':
        return {
          templateCode: 'auth.account_created',
          category: 'AUTH',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `auth.account.created:${id}`,
          variables: {},
        };
      case 'auth.email.verification_sent':
        // Token link is sent via auth MAIL_PORT (critical path). Durable queue gets IN_APP only.
        return {
          templateCode: 'auth.email_verification',
          category: 'AUTH',
          channels: ['IN_APP'],
          priority: 'HIGH',
          dedupeKey: `auth.email.verification_sent:${id}`,
          variables: {},
        };
      case 'auth.email.verified':
        return {
          templateCode: 'auth.email_verified',
          category: 'AUTH',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'NORMAL',
          dedupeKey: `auth.email.verified:${id}`,
          variables: {},
        };
      case 'auth.password_reset.requested':
        // Reset token link is sent via auth MAIL_PORT. Durable queue gets IN_APP notice.
        return {
          templateCode: 'auth.password_reset',
          category: 'AUTH',
          channels: ['IN_APP'],
          priority: 'HIGH',
          dedupeKey: `auth.password_reset.requested:${id}`,
          variables: {},
        };
      case 'auth.password.changed':
        return {
          templateCode: 'auth.password_changed',
          category: 'SECURITY',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `auth.password.changed:${id}`,
          variables: {},
        };
      case 'auth.login.new_device':
        return {
          templateCode: 'security.new_device',
          category: 'SECURITY',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `auth.login.new_device:${id}`,
          variables: {
            deviceName: String(p.deviceName ?? 'Unknown device'),
            platform: String(p.platform ?? 'unknown'),
          },
        };
      case 'auth.device.revoked':
        return {
          templateCode: 'security.device_revoked',
          category: 'SECURITY',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `auth.device.revoked:${id}`,
          variables: {
            deviceName: String(p.deviceName ?? 'Device'),
          },
        };
      case 'compliance.kyc.submitted':
        return {
          templateCode: 'kyc.submitted',
          category: 'KYC',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'NORMAL',
          dedupeKey: `kyc.submitted:${id}`,
          variables: {},
        };
      case 'compliance.kyc.approved':
        return {
          templateCode: 'kyc.approved',
          category: 'KYC',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `kyc.approved:${id}`,
          variables: {},
        };
      case 'compliance.kyc.rejected':
        return {
          templateCode: 'kyc.rejected',
          category: 'KYC',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `kyc.rejected:${id}`,
          variables: {
            reason: String(
              p.customerVisibleReason ?? p.reason ?? 'Verification could not be completed',
            ),
          },
        };
      case 'compliance.kyc.resubmission_required':
        return {
          templateCode: 'kyc.resubmission_required',
          category: 'KYC',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `kyc.resubmission:${id}`,
          variables: {
            instructions: String(
              p.customerVisibleReason ?? p.reason ?? 'Please resubmit your documents',
            ),
          },
        };
      case 'wallet.transfer_review.pending':
        return {
          templateCode: 'transaction.review_pending',
          category: 'TRANSACTION',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `tx.review.pending:${id}`,
          variables: {
            assetCode: String(p.assetCode ?? ''),
            amountUsd: String(p.amountUsdCents ? Number(p.amountUsdCents) / 100 : ''),
          },
        };
      case 'wallet.transfer_review.approved':
        return {
          templateCode: 'transaction.review_approved',
          category: 'TRANSACTION',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `tx.review.approved:${id}`,
          variables: {
            assetCode: String(p.assetCode ?? ''),
          },
        };
      case 'wallet.transfer_review.rejected':
        return {
          templateCode: 'transaction.review_rejected',
          category: 'TRANSACTION',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'HIGH',
          dedupeKey: `tx.review.rejected:${id}`,
          variables: {
            assetCode: String(p.assetCode ?? ''),
            reason: String(
              p.customerVisibleReason ?? p.reason ?? 'Transaction could not be approved',
            ),
          },
        };
      case 'wallet.transfer.completed':
        return {
          templateCode: 'transaction.completed',
          category: 'TRANSACTION',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'NORMAL',
          dedupeKey: `tx.completed:${id}`,
          variables: {
            assetCode: String(p.assetCode ?? p.assetTicker ?? ''),
            amount: String(p.amount ?? ''),
            network: String(p.networkLabel ?? p.network ?? ''),
            txHash: String(p.txHash ?? p.hash ?? ''),
          },
        };
      case 'blockchain.deposit.detected':
        return {
          templateCode: 'deposit.detected',
          category: 'DEPOSIT',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'NORMAL',
          dedupeKey: `deposit.detected:${id}`,
          variables: {
            assetCode: String(p.assetCode ?? ''),
            amount: String(p.amount ?? ''),
            network: String(p.network ?? ''),
          },
        };
      case 'blockchain.deposit.confirmed':
        return {
          templateCode: 'deposit.confirmed',
          category: 'DEPOSIT',
          channels: ['EMAIL', 'IN_APP'],
          priority: 'NORMAL',
          dedupeKey: `deposit.confirmed:${id}`,
          variables: {
            assetCode: String(p.assetCode ?? ''),
            amount: String(p.amount ?? ''),
            network: String(p.network ?? ''),
          },
        };
      default:
        return null;
    }
  }
}
