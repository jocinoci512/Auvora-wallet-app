import type { PrismaService } from '@auvora/database';
import type { NetworkConfigRepositoryPort } from '../../application/ports/network-config-repository.port';
import type { SimulatorLedgerPort } from '../../application/ports/simulator-ledger.port';
import { BitcoinProvider } from './bitcoin.provider';

function createLedgerMock(): SimulatorLedgerPort {
  return {
    getBalance: jest.fn().mockResolvedValue('0'),
    credit: jest.fn().mockResolvedValue('0'),
    debit: jest.fn().mockResolvedValue('0'),
    getBlockHeight: jest.fn().mockResolvedValue(1n),
    advanceBlockHeight: jest.fn().mockResolvedValue(2n),
    addToMempool: jest.fn().mockResolvedValue(undefined),
    removeFromMempool: jest.fn().mockResolvedValue(undefined),
    listMempool: jest.fn().mockResolvedValue([]),
    watchAddress: jest.fn().mockResolvedValue(undefined),
    isWatched: jest.fn().mockResolvedValue(false),
  };
}

describe('BitcoinProvider', () => {
  const prisma = {} as PrismaService;
  const networkConfig: NetworkConfigRepositoryPort = {
    findByChain: jest.fn().mockResolvedValue(null),
    listAll: jest.fn().mockResolvedValue([]),
    listEnabled: jest.fn().mockResolvedValue([]),
  };

  it('generates a valid P2PKH address that passes its own validation', async () => {
    const provider = new BitcoinProvider(prisma, networkConfig, createLedgerMock());
    const generated = await provider.createAddress();

    expect(generated.address).toMatch(/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/);
    expect(provider.validateAddress(generated.address)).toBe(true);
  });

  it('rejects addresses from other chains', () => {
    const provider = new BitcoinProvider(prisma, networkConfig, createLedgerMock());
    expect(provider.validateAddress('0x' + 'a'.repeat(40))).toBe(false);
    expect(provider.validateAddress('not-an-address')).toBe(false);
  });

  it('generates unique addresses on repeated calls', async () => {
    const provider = new BitcoinProvider(prisma, networkConfig, createLedgerMock());
    const first = await provider.createAddress();
    const second = await provider.createAddress();
    expect(first.address).not.toBe(second.address);
  });
});
