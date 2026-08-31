/**
 * @jest-environment jsdom
 */

const mockState = {
  mode: 'ok' as 'ok' | 'down',
  bodies: [] as unknown[],
};

jest.mock('./derive-public-accounts', () => ({
  deriveEvmPublicAccounts: jest.fn(() => []),
}));

jest.mock('../api-client', () => ({
  createApiClient: () => ({
    importPublicWalletAddress: async (body: unknown) => {
      if (mockState.mode === 'down') {
        throw new Error('ECONNREFUSED');
      }
      mockState.bodies.push(body);
      return { id: `w-${mockState.bodies.length}` };
    },
  }),
}));

import { ensurePublicWalletsRegistered, writeWalletPublicSession } from './wallet-public-session';

describe('ensurePublicWalletsRegistered', () => {
  beforeEach(() => {
    mockState.mode = 'ok';
    mockState.bodies = [];
    sessionStorage.clear();
  });

  it('posts public EVM accounts without secrets and is idempotent', async () => {
    const evm = `0x${'a'.repeat(40)}`;
    writeWalletPublicSession({
      ownerUserId: 'df1db712-5e50-42c1-92fc-2c7236244cf8',
      initializedAt: new Date().toISOString(),
      ethereumAddress: evm,
      registered: false,
      accounts: [
        {
          network: 'ETHEREUM',
          assetCode: 'ETH',
          address: evm,
          path: "m/44'/60'/0'/0/0",
          accountIndex: 0,
        },
        {
          network: 'BNB_SMART_CHAIN',
          assetCode: 'BNB',
          address: evm,
          path: "m/44'/60'/0'/0/0",
          accountIndex: 0,
        },
        {
          network: 'POLYGON',
          assetCode: 'POL',
          address: evm,
          path: "m/44'/60'/0'/0/0",
          accountIndex: 0,
        },
      ],
    });

    const first = await ensurePublicWalletsRegistered();
    const second = await ensurePublicWalletsRegistered();
    expect(first?.registered).toBe(true);
    expect(second?.registered).toBe(true);
    expect(mockState.bodies).toHaveLength(6);
    for (const body of mockState.bodies) {
      const encoded = JSON.stringify(body).toLowerCase();
      expect(encoded).not.toMatch(/mnemonic|privatekey|seed|password/);
      expect(body).toMatchObject({
        networkEnv: 'testnet',
        selfCustody: true,
        clientPlatform: 'web',
      });
    }
    expect((mockState.bodies[0] as { assetCode: string }).assetCode).toBe('ETH');
    expect((mockState.bodies[1] as { assetCode: string }).assetCode).toBe('BNB');
    expect((mockState.bodies[2] as { assetCode: string }).assetCode).toBe('POL');
  });

  it('does not mark registered when the backend is down, leaving local session intact', async () => {
    mockState.mode = 'down';
    const evm = `0x${'b'.repeat(40)}`;
    writeWalletPublicSession({
      ownerUserId: 'df1db712-5e50-42c1-92fc-2c7236244cf8',
      initializedAt: new Date().toISOString(),
      ethereumAddress: evm,
      registered: false,
      accounts: [
        {
          network: 'ETHEREUM',
          assetCode: 'ETH',
          address: evm,
          path: "m/44'/60'/0'/0/0",
          accountIndex: 0,
        },
      ],
    });

    const next = await ensurePublicWalletsRegistered();
    expect(next?.ethereumAddress).toBe(evm);
    expect(next?.registered).toBe(false);
  });
});
