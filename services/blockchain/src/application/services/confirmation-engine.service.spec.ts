import { ChainNetwork, ChainTxDirection, ChainTxStatus } from '@auvora/database';
import type {
  ChainTransactionRecord,
  ChainTransactionRepositoryPort,
} from '../ports/chain-transaction-repository.port';
import type { NetworkConfigRecord, NetworkConfigRepositoryPort } from '../ports/network-config-repository.port';
import type { EventBusPort } from '../../domain';
import { ConfirmationEngine } from './confirmation-engine.service';

const notifications = { publishEvent: jest.fn().mockResolvedValue(undefined) };
const ai = { publishEvent: jest.fn().mockResolvedValue(undefined) };
const analytics = { publishEvent: jest.fn().mockResolvedValue(undefined) };

function buildTx(overrides: Partial<ChainTransactionRecord> = {}): ChainTransactionRecord {
  return {
    id: 'tx-1',
    chain: ChainNetwork.BITCOIN,
    networkId: 'network-1',
    addressId: 'address-1',
    txHash: 'hash-1',
    direction: ChainTxDirection.INCOMING,
    status: ChainTxStatus.PENDING,
    amount: '1.0',
    feeAmount: '0',
    fromAddress: null,
    toAddress: 'addr',
    blockNumber: '100',
    confirmations: 0,
    requiredConfirmations: 3,
    broadcastAt: new Date(),
    confirmedAt: null,
    failedAt: null,
    failureReason: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildNetworkConfig(requiredConfirmations: number): NetworkConfigRecord {
  return {
    id: 'network-1',
    chain: ChainNetwork.BITCOIN,
    displayName: 'Bitcoin',
    isEnabled: true,
    requiredConfirmations,
    blockTimeSeconds: 600,
    nativeSymbol: 'BTC',
    explorerUrl: null,
    rpcUrl: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ConfirmationEngine', () => {
  it('reads the confirmation threshold from network config, never hardcoding it', async () => {
    const transactions: ChainTransactionRepositoryPort = {
      create: jest.fn(),
      findById: jest.fn(),
      findByChainTxHash: jest.fn(),
      findByIdOrHash: jest.fn(),
      list: jest.fn(),
      updateStatus: jest.fn().mockImplementation(async (id, status) => buildTx({ id, status })),
      updateConfirmations: jest
        .fn()
        .mockImplementation(async (id, confirmations) => buildTx({ id, confirmations })),
      findActiveByChain: jest.fn(),
    };
    const networkConfig: NetworkConfigRepositoryPort = {
      findByChain: jest.fn().mockResolvedValue(buildNetworkConfig(6)),
      listAll: jest.fn(),
      listEnabled: jest.fn(),
    };
    const eventBus: EventBusPort = { publish: jest.fn().mockResolvedValue(undefined) };

    const engine = new ConfirmationEngine(transactions, networkConfig, eventBus, notifications as never, ai as never, analytics as never);
    const tx = buildTx({ blockNumber: '100', requiredConfirmations: 6 });

    const belowThreshold = await engine.updateTransactionConfirmations(tx, 102n, 6);
    expect(belowThreshold.status).not.toBe(ChainTxStatus.CONFIRMED);
    expect(eventBus.publish).not.toHaveBeenCalled();

    const atThreshold = await engine.updateTransactionConfirmations(tx, 105n, 6);
    expect(transactions.updateStatus).toHaveBeenCalledWith(
      tx.id,
      ChainTxStatus.CONFIRMED,
      expect.objectContaining({ confirmedAt: expect.any(Date) }),
    );
    expect(atThreshold.status).toBe(ChainTxStatus.CONFIRMED);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('does not confirm a transaction that has not yet been included in a block', async () => {
    const transactions: ChainTransactionRepositoryPort = {
      create: jest.fn(),
      findById: jest.fn(),
      findByChainTxHash: jest.fn(),
      findByIdOrHash: jest.fn(),
      list: jest.fn(),
      updateStatus: jest.fn(),
      updateConfirmations: jest.fn(),
      findActiveByChain: jest.fn(),
    };
    const networkConfig: NetworkConfigRepositoryPort = {
      findByChain: jest.fn().mockResolvedValue(buildNetworkConfig(3)),
      listAll: jest.fn(),
      listEnabled: jest.fn(),
    };
    const eventBus: EventBusPort = { publish: jest.fn() };

    const engine = new ConfirmationEngine(transactions, networkConfig, eventBus, notifications as never, ai as never, analytics as never);
    const mempoolTx = buildTx({ blockNumber: null, status: ChainTxStatus.MEMPOOL });

    const result = await engine.updateTransactionConfirmations(mempoolTx, 10n, 3);
    expect(result).toBe(mempoolTx);
    expect(transactions.updateConfirmations).not.toHaveBeenCalled();
  });
});
