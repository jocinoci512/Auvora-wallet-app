import { EventNotificationMapperService } from './event-notification-mapper.service';

describe('EventNotificationMapperService', () => {
  const notifications = {
    send: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        email: 'user@auvora.io',
        firstName: 'Ada',
        username: 'ada',
      }),
    },
  };

  function createService(): EventNotificationMapperService {
    return new EventNotificationMapperService(notifications as never, prisma as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('idempotency dedupeKey', () => {
    it('builds stable per-channel dedupe keys from event type and aggregateId', async () => {
      const service = createService();

      await service.mapAndEnqueue({
        eventType: 'compliance.kyc.approved',
        aggregateId: 'kyc-case-42',
        payload: { ownerUserId: 'user-1' },
      });

      expect(notifications.send).toHaveBeenCalledTimes(2);
      const keys = notifications.send.mock.calls.map(
        (call: [{ dedupeKey: string }]) => call[0].dedupeKey,
      );
      expect(keys).toEqual(
        expect.arrayContaining([
          'kyc.approved:kyc-case-42:EMAIL',
          'kyc.approved:kyc-case-42:IN_APP',
        ]),
      );
    });

    it('reuses the same dedupeKey when the same event is mapped twice', async () => {
      const service = createService();
      const input = {
        eventType: 'blockchain.deposit.detected' as const,
        aggregateId: 'addr-1:100',
        payload: {
          ownerUserId: 'user-1',
          assetCode: 'ETH',
          amount: '0.5',
          network: 'Ethereum Sepolia (TESTNET)',
        },
      };

      await service.mapAndEnqueue(input);
      const firstKeys = notifications.send.mock.calls.map(
        (call: [{ dedupeKey: string }]) => call[0].dedupeKey,
      );

      notifications.send.mockClear();
      await service.mapAndEnqueue(input);
      const secondKeys = notifications.send.mock.calls.map(
        (call: [{ dedupeKey: string }]) => call[0].dedupeKey,
      );

      expect(secondKeys).toEqual(firstKeys);
      expect(firstKeys).toEqual(
        expect.arrayContaining([
          'deposit.detected:addr-1:100:EMAIL',
          'deposit.detected:addr-1:100:IN_APP',
        ]),
      );
    });
  });

  describe('KYC approved mapping', () => {
    it('maps approval to the customer template without internal notes', async () => {
      const service = createService();

      await service.mapAndEnqueue({
        eventType: 'compliance.kyc.approved',
        aggregateId: 'kyc-approved-1',
        payload: {
          ownerUserId: 'user-1',
          internalNote: 'QA analyst comment — do not disclose',
        },
      });

      expect(notifications.send).toHaveBeenCalledTimes(2);
      for (const call of notifications.send.mock.calls) {
        expect(call[0].templateCode).toBe('kyc.approved');
        expect(JSON.stringify(call[0])).not.toContain('QA analyst');
        expect(call[0].variables).not.toHaveProperty('internalNote');
      }
    });
  });

  describe('KYC reject reason mapping', () => {
    it('maps customerVisibleReason and never leaks internalNote', async () => {
      const service = createService();

      await service.mapAndEnqueue({
        eventType: 'compliance.kyc.rejected',
        aggregateId: 'kyc-99',
        payload: {
          ownerUserId: 'user-1',
          customerVisibleReason: 'Document image was unclear',
          reason: 'fallback-reason',
          internalNote: 'SANCTIONS_HIT_INTERNAL_CASE_7741 — do not disclose',
        },
      });

      expect(notifications.send).toHaveBeenCalled();
      for (const call of notifications.send.mock.calls) {
        const variables = call[0].variables as Record<string, unknown>;
        expect(variables.reason).toBe('Document image was unclear');
        expect(JSON.stringify(variables)).not.toContain('SANCTIONS_HIT');
        expect(JSON.stringify(variables)).not.toContain('internalNote');
        expect(variables).not.toHaveProperty('internalNote');
      }
    });

    it('falls back to reason when customerVisibleReason is absent, still ignoring internalNote', async () => {
      const service = createService();

      await service.mapAndEnqueue({
        eventType: 'compliance.kyc.rejected',
        aggregateId: 'kyc-100',
        payload: {
          ownerUserId: 'user-1',
          reason: 'Please provide a clearer photo of your ID',
          internalNote: 'analyst: possible synthetic id — escalate',
        },
      });

      const variables = notifications.send.mock.calls[0][0].variables as Record<string, unknown>;
      expect(variables.reason).toBe('Please provide a clearer photo of your ID');
      expect(JSON.stringify(variables)).not.toContain('synthetic');
      expect(JSON.stringify(variables)).not.toContain('escalate');
    });

    it('maps resubmission instructions from customerVisibleReason without internal notes', async () => {
      const service = createService();

      await service.mapAndEnqueue({
        eventType: 'compliance.kyc.resubmission_required',
        aggregateId: 'kyc-101',
        payload: {
          ownerUserId: 'user-1',
          customerVisibleReason: 'Upload a utility bill dated within 90 days',
          internalNote: 'fraud_score=91 queue=manual',
        },
      });

      const variables = notifications.send.mock.calls[0][0].variables as Record<string, unknown>;
      expect(variables.instructions).toBe('Upload a utility bill dated within 90 days');
      expect(JSON.stringify(variables)).not.toContain('fraud_score');
      expect(variables).not.toHaveProperty('internalNote');
    });
  });

  describe('auth durable email / IN_APP mappings', () => {
    it('maps auth.email.verification_sent to IN_APP only (token mail is critical-path MAIL_PORT)', async () => {
      const service = createService();

      await service.mapAndEnqueue({
        eventType: 'auth.email.verification_sent',
        aggregateId: 'user-1',
        payload: { ownerUserId: 'user-1' },
      });

      expect(notifications.send).toHaveBeenCalledTimes(1);
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateCode: 'auth.email_verification',
          channel: 'IN_APP',
          dedupeKey: 'auth.email.verification_sent:user-1:IN_APP',
        }),
      );
    });

    it('maps auth.password_reset.requested to IN_APP', async () => {
      const service = createService();

      await service.mapAndEnqueue({
        eventType: 'auth.password_reset.requested',
        aggregateId: 'user-1',
        payload: { ownerUserId: 'user-1' },
      });

      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateCode: 'auth.password_reset',
          channel: 'IN_APP',
          dedupeKey: 'auth.password_reset.requested:user-1:IN_APP',
        }),
      );
    });

    it('maps core auth security events to EMAIL + IN_APP', async () => {
      const service = createService();
      const events = [
        'auth.account.created',
        'auth.email.verified',
        'auth.password.changed',
        'auth.login.new_device',
        'auth.device.revoked',
      ] as const;

      for (const eventType of events) {
        notifications.send.mockClear();
        await service.mapAndEnqueue({
          eventType,
          aggregateId: 'agg-1',
          payload: {
            ownerUserId: 'user-1',
            deviceName: 'Pixel',
            platform: 'android',
          },
        });
        expect(notifications.send).toHaveBeenCalledTimes(2);
        const channels = notifications.send.mock.calls.map(
          (call: [{ channel: string }]) => call[0].channel,
        );
        expect(channels).toEqual(expect.arrayContaining(['EMAIL', 'IN_APP']));
      }
    });

    it('maps wallet.transfer.completed to transaction.completed templates', async () => {
      const service = createService();

      await service.mapAndEnqueue({
        eventType: 'wallet.transfer.completed',
        aggregateId: 'tx-done-1',
        payload: {
          ownerUserId: 'user-1',
          assetCode: 'ETH',
          amount: '0.0001',
          networkLabel: 'Auvora Local EVM QA',
          txHash: '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f',
        },
      });

      expect(notifications.send).toHaveBeenCalledTimes(2);
      for (const call of notifications.send.mock.calls) {
        expect(call[0].templateCode).toBe('transaction.completed');
        expect(call[0].dedupeKey).toContain('tx.completed:');
      }
    });
  });
});
