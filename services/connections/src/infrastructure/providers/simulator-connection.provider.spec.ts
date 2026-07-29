import { ChainNetwork } from '@auvora/database';
import { SimulatorConnectionProvider } from './simulator-connection.provider';

describe('SimulatorConnectionProvider', () => {
  const provider = new SimulatorConnectionProvider();

  it('pairs a ledger device and returns accounts', async () => {
    const paired = await provider.pairDevice('ledger-nano-x-sim-1');
    expect(paired.accounts.length).toBeGreaterThan(0);
    expect(paired.firmwareCompatible).toBe(true);
  });

  it('rejects signing for readonly kind', async () => {
    await expect(
      provider.prepareSign({
        kind: 'READONLY',
        connectionRef: 'watch-1',
        network: ChainNetwork.ETHEREUM,
        payloadType: 'MESSAGE',
        payload: 'x',
      }),
    ).rejects.toMatchObject({ code: 'CONNECTIONS_SIGNING_NOT_ALLOWED' });
  });

  it('connects browser wallet', async () => {
    const connected = await provider.connectBrowserWallet('metamask_sim');
    expect(connected.connected).toBe(true);
    expect(connected.accounts.length).toBeGreaterThan(0);
  });
});
