import { ProviderUnavailableError } from '../../domain';
import { ChannelProviderRegistry } from './provider-registry';

function buildEnv(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    NOTIFICATIONS_SIMULATOR_ENABLED: true,
    NOTIFICATIONS_CHANNEL_EMAIL_ENABLED: true,
    NOTIFICATIONS_CHANNEL_SMS_ENABLED: true,
    NOTIFICATIONS_CHANNEL_PUSH_ENABLED: true,
    NOTIFICATIONS_CHANNEL_IN_APP_ENABLED: true,
    NOTIFICATIONS_CHANNEL_BROWSER_ENABLED: true,
    NOTIFICATIONS_CHANNEL_WEBHOOK_ENABLED: true,
    NOTIFICATIONS_CHANNEL_SLACK_ENABLED: true,
    NOTIFICATIONS_CHANNEL_TEAMS_ENABLED: true,
    ...overrides,
  } as never;
}

function buildPrisma(enabledRow: Record<string, unknown> | null = { id: 'provider-1', priority: 100 }) {
  return {
    notificationChannelProvider: {
      findFirst: jest.fn().mockResolvedValue(enabledRow),
    },
  };
}

describe('ChannelProviderRegistry', () => {
  it('resolves simulator providers for every channel when simulators are enabled and a DB row is enabled', async () => {
    const registry = new ChannelProviderRegistry(buildEnv(), buildPrisma() as never);
    const provider = await registry.resolve('EMAIL');
    expect(provider.getCode()).toBe('simulator-email');
    const result = await provider.send({ notificationId: 'n1', recipient: 'user@auvora.io', body: 'hi' });
    expect(result.success).toBe(true);
  });

  it('throws ProviderUnavailableError when no enabled provider row exists for the channel', async () => {
    const prisma = buildPrisma(null);
    const registry = new ChannelProviderRegistry(buildEnv(), prisma as never);

    await expect(registry.resolve('SMS')).rejects.toThrow(ProviderUnavailableError);
    expect(prisma.notificationChannelProvider.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { channel: 'SMS', isEnabled: true } }),
    );
  });

  it('treats a channel as disabled via env flag regardless of DB state', async () => {
    const registry = new ChannelProviderRegistry(buildEnv({ NOTIFICATIONS_CHANNEL_SMS_ENABLED: false }), buildPrisma() as never);

    const provider = await registry.resolve('SMS');
    expect(provider.getCode()).toBe('unavailable-sms');
    await expect(provider.send({ notificationId: 'n1', recipient: '+15550001111', body: 'hi' })).rejects.toThrow(
      ProviderUnavailableError,
    );
  });

  it('falls back to unavailable providers for EMAIL/SMS/PUSH/SLACK/TEAMS when simulators are off and no HTTP URL is set', async () => {
    const registry = new ChannelProviderRegistry(buildEnv({ NOTIFICATIONS_SIMULATOR_ENABLED: false }), buildPrisma() as never);
    const provider = await registry.resolve('SMS');
    expect(provider.getCode()).toBe('unavailable-sms');
  });

  it('uses the local in-app provider for IN_APP/BROWSER/WEBHOOK when simulators are off', async () => {
    const registry = new ChannelProviderRegistry(buildEnv({ NOTIFICATIONS_SIMULATOR_ENABLED: false }), buildPrisma() as never);
    const provider = await registry.resolve('IN_APP');
    expect(provider.getCode()).toBe('local-in_app');
    const result = await provider.send({ notificationId: 'n1', recipient: 'user-1', body: 'hi' });
    expect(result.success).toBe(true);
  });

  it('uses an HTTP provider when a channel-specific provider URL is configured', async () => {
    const registry = new ChannelProviderRegistry(
      buildEnv({ NOTIFICATIONS_SIMULATOR_ENABLED: false, NOTIFICATIONS_EMAIL_PROVIDER_URL: 'https://esp.example.com/send' }),
      buildPrisma() as never,
    );
    const provider = await registry.resolve('EMAIL');
    expect(provider.getCode()).toBe('http-email');
  });

  it('lists a provider for every supported channel', async () => {
    const registry = new ChannelProviderRegistry(buildEnv(), buildPrisma() as never);
    expect(await registry.listAll()).toHaveLength(8);
  });
});
