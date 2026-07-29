import { ChainNetwork } from '@auvora/database';
import { ConnectionProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { LedgerStyleProvider } from '../../infrastructure/providers/ledger-style.provider';
import { SimulatorConnectionProvider } from '../../infrastructure/providers/simulator-connection.provider';
import { WalletConnectStyleProvider } from '../../infrastructure/providers/walletconnect-style.provider';
import {
  assertValidPermissions,
  normalizeOrigin,
  WEB3_SUPPORTED_NETWORKS,
} from '../../domain/dapp-permissions';

describe('web3 dApp platform integration', () => {
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

  it('supports all Phase 26 Web3 networks via provider abstraction', async () => {
    expect(WEB3_SUPPORTED_NETWORKS).toHaveLength(5);
    for (const network of WEB3_SUPPORTED_NETWORKS) {
      const proposal = await registry.createWalletConnectProposal({
        networks: [network],
        permissions: assertValidPermissions(['VIEW_ADDRESSES', 'REQUEST_SIGNATURES']),
      });
      expect(proposal.requestedNetworks).toContain(network);
      expect(proposal.qrPayload).toContain('wc:');
    }
  });

  it('prepares typed-data signing and verifies signature completion', async () => {
    const prepared = await registry.prepareSign({
      kind: 'HARDWARE',
      connectionRef: 'ledger-nano-x-sim-1',
      network: ChainNetwork.ETHEREUM,
      payloadType: 'TYPED_DATA',
      payload: JSON.stringify({ domain: { name: 'Auvora' }, message: { action: 'connect' } }),
    });
    expect(prepared.payloadType).toBe('TYPED_DATA');
    expect(prepared.preview).toContain('typed-data:');
    expect(prepared.simulationOk).toBe(true);

    const completed = await registry.completeSign(prepared.requestId, true);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.verified).toBe(true);
  });

  it('recovers from user rejection without leaking secrets', async () => {
    const prepared = await registry.prepareSign({
      kind: 'WALLETCONNECT',
      connectionRef: 'wc-session-sim',
      network: ChainNetwork.SOLANA,
      payloadType: 'MESSAGE',
      payload: 'auth challenge',
    });
    const rejected = await registry.completeSign(prepared.requestId, false);
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.signature).toBeUndefined();
    expect(JSON.stringify(rejected)).not.toMatch(/private|secret|mnemonic/i);
  });

  it('normalizes origins for permission isolation boundaries', () => {
    expect(normalizeOrigin('HTTPS://DAPP.EXAMPLE.COM/connect?x=1')).toBe(
      'https://dapp.example.com',
    );
    expect(normalizeOrigin('dapp.example.com')).toBe('https://dapp.example.com');
  });

  it('health-checks provider registry used by connection monitor', async () => {
    await expect(registry.healthCheck()).resolves.toMatchObject({ healthy: true });
  });
});
