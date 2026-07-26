import { ChainAddressStatus, ChainNetwork } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import type {
  ChainAddressRecord,
  ChainAddressRepositoryPort,
} from '../ports/chain-address-repository.port';
import type { NetworkConfigRecord, NetworkConfigRepositoryPort } from '../ports/network-config-repository.port';
import type { ProviderFactoryPort } from '../ports/provider-factory.port';
import { ForbiddenError, ValidationError, type EventBusPort } from '../../domain';
import { BlockchainService } from './blockchain.service';

function buildAddress(overrides: Partial<ChainAddressRecord> = {}): ChainAddressRecord {
  return {
    id: 'address-1',
    chain: ChainNetwork.BITCOIN,
    networkId: 'network-1',
    walletId: null,
    ownerUserId: 'owner-1',
    address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
    label: null,
    isPrimary: false,
    status: ChainAddressStatus.ACTIVE,
    watched: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    activatedAt: new Date(),
    archivedAt: null,
    ...overrides,
  };
}

function buildUser(overrides: Partial<JwtAccessClaims> = {}): JwtAccessClaims {
  return {
    sub: 'owner-1',
    email: 'owner@example.com',
    roles: ['user'],
    permissions: [],
    sessionId: 'session-1',
    ...overrides,
  } as JwtAccessClaims;
}

describe('BlockchainService', () => {
  function createService(addressOverrides: Partial<ChainAddressRecord> = {}) {
    const address = buildAddress(addressOverrides);
    const addresses: ChainAddressRepositoryPort = {
      create: jest.fn().mockResolvedValue(address),
      findById: jest.fn().mockResolvedValue(address),
      findByChainAddress: jest.fn(),
      list: jest.fn().mockResolvedValue({ items: [address], total: 1 }),
      update: jest.fn(),
      setStatus: jest.fn().mockResolvedValue(address),
      setPrimary: jest.fn(),
      listWatched: jest.fn(),
    };
    const networkConfig: NetworkConfigRepositoryPort = {
      findByChain: jest.fn().mockResolvedValue({
        id: 'network-1',
        chain: ChainNetwork.BITCOIN,
        displayName: 'Bitcoin',
        isEnabled: true,
        requiredConfirmations: 3,
        blockTimeSeconds: 600,
        nativeSymbol: 'BTC',
        explorerUrl: null,
        rpcUrl: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies NetworkConfigRecord),
      listAll: jest.fn(),
      listEnabled: jest.fn(),
    };
    const provider = {
      createAddress: jest.fn().mockResolvedValue({ address: address.address, metadata: {} }),
      watchAddress: jest.fn().mockResolvedValue(undefined),
      validateAddress: jest.fn().mockReturnValue(true),
      getBalance: jest.fn().mockResolvedValue('1.5'),
    };
    const providerFactory: ProviderFactoryPort = {
      getProvider: jest.fn().mockReturnValue(provider),
      getSupportedChains: jest.fn().mockReturnValue([ChainNetwork.BITCOIN]),
      hasProvider: jest.fn().mockReturnValue(true),
    };
    const eventBus: EventBusPort = { publish: jest.fn().mockResolvedValue(undefined) };

    const service = new BlockchainService(addresses, networkConfig, providerFactory, eventBus);
    return { service, addresses, networkConfig, providerFactory, eventBus, address };
  }

  it('creates an address for the requesting owner and publishes AddressCreated', async () => {
    const { service, eventBus } = createService();
    const result = await service.createAddress({ ownerUserId: 'owner-1', chain: ChainNetwork.BITCOIN });
    expect(result.ownerUserId).toBe('owner-1');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.any(String), chain: ChainNetwork.BITCOIN }),
    );
  });

  it('rejects address creation on a disabled chain', async () => {
    const { service, networkConfig } = createService();
    (networkConfig.findByChain as jest.Mock).mockResolvedValueOnce({
      id: 'network-1',
      chain: ChainNetwork.BITCOIN,
      isEnabled: false,
      requiredConfirmations: 3,
    });
    await expect(
      service.createAddress({ ownerUserId: 'owner-1', chain: ChainNetwork.BITCOIN }),
    ).rejects.toThrow(ValidationError);
  });

  it('allows the owner to fetch their own address', async () => {
    const { service } = createService();
    const result = await service.getAddress('address-1', buildUser({ sub: 'owner-1' }));
    expect(result.id).toBe('address-1');
  });

  it('denies access to another user who does not own the address and lacks admin permission', async () => {
    const { service } = createService();
    await expect(service.getAddress('address-1', buildUser({ sub: 'someone-else' }))).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('allows an admin permission holder to access addresses they do not own', async () => {
    const { service } = createService();
    const admin = buildUser({ sub: 'someone-else', permissions: ['blockchain:admin'] as never });
    const result = await service.getAddress('address-1', admin);
    expect(result.id).toBe('address-1');
  });

  it('scopes listAddressesForUser to the requested owner unless the requester is an admin', async () => {
    const { service } = createService();
    await expect(
      service.listAddressesForUser('owner-1', buildUser({ sub: 'someone-else' }), {}),
    ).rejects.toThrow(ForbiddenError);

    const own = await service.listAddressesForUser('owner-1', buildUser({ sub: 'owner-1' }), {});
    expect(own.total).toBe(1);
  });
});
