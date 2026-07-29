import { ChainNetwork } from '@auvora/database';
import { ConnectionProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { LedgerStyleProvider } from '../../infrastructure/providers/ledger-style.provider';
import { SimulatorConnectionProvider } from '../../infrastructure/providers/simulator-connection.provider';
import { WalletConnectStyleProvider } from '../../infrastructure/providers/walletconnect-style.provider';

describe('connections provider integration', () => {
  const env = {
    CONNECTIONS_SIMULATOR_ENABLED: true,
    CONNECTIONS_PROVIDER_TIMEOUT_MS: 5000,
  } as never;
  const simulator = new SimulatorConnectionProvider();
  const registry = new ConnectionProviderRegistry(
    env,
    simulator,
    new LedgerStyleProvider(simulator),
    new WalletConnectStyleProvider(simulator),
  );

  it('discovers hardware devices', async () => {
    const devices = await registry.discoverDevices();
    expect(devices.length).toBeGreaterThan(0);
  });

  it('creates walletconnect proposal with qr and deep link', async () => {
    const proposal = await registry.createWalletConnectProposal({
      networks: [ChainNetwork.ETHEREUM],
      permissions: ['accounts', 'sign'],
    });
    expect(proposal.qrPayload).toContain('wc:');
    expect(proposal.deepLink).toContain('auvora://wc');
  });

  it('prepares and completes a confirmed signature', async () => {
    const prepared = await registry.prepareSign({
      kind: 'HARDWARE',
      connectionRef: 'ledger-nano-x-sim-1',
      network: ChainNetwork.ETHEREUM,
      payloadType: 'MESSAGE',
      payload: 'hello auvora',
    });
    const result = await registry.completeSign(prepared.requestId, true);
    expect(result.status).toBe('COMPLETED');
    expect(result.verified).toBe(true);
  });

  it('health checks registry', async () => {
    await expect(registry.healthCheck()).resolves.toMatchObject({ healthy: true });
  });
});
