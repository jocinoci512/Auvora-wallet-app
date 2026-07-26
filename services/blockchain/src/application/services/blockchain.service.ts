import { Inject, Injectable } from '@nestjs/common';
import { ChainAddressStatus, type ChainNetwork, type Prisma } from '@auvora/database';
import type { JwtAccessClaims, PermissionCode } from '@auvora/types';
import {
  CHAIN_ADDRESS_REPOSITORY,
  type ChainAddressFilters,
  type ChainAddressRecord,
  type ChainAddressRepositoryPort,
} from '../ports/chain-address-repository.port';
import {
  NETWORK_CONFIG_REPOSITORY,
  type NetworkConfigRecord,
  type NetworkConfigRepositoryPort,
} from '../ports/network-config-repository.port';
import { PROVIDER_FACTORY, type ProviderFactoryPort } from '../ports/provider-factory.port';
import {
  BlockchainEventType,
  EVENT_BUS,
  type EventBusPort,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../domain';
import { PERMISSION_BLOCKCHAIN_ADMIN } from '../../domain/permission-codes';

export interface CreateAddressInput {
  ownerUserId: string;
  chain: ChainNetwork;
  walletId?: string;
  label?: string;
}

export interface UpdateAddressInput {
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface NetworkStats {
  config: NetworkConfigRecord;
  blockHeight: string;
  healthy: boolean;
  latencyMs: number;
}

@Injectable()
export class BlockchainService {
  constructor(
    @Inject(CHAIN_ADDRESS_REPOSITORY) private readonly addresses: ChainAddressRepositoryPort,
    @Inject(NETWORK_CONFIG_REPOSITORY) private readonly networkConfig: NetworkConfigRepositoryPort,
    @Inject(PROVIDER_FACTORY) private readonly providerFactory: ProviderFactoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  getSupportedChains(): ChainNetwork[] {
    return this.providerFactory.getSupportedChains();
  }

  validateAddress(chain: ChainNetwork, address: string): boolean {
    if (!this.providerFactory.hasProvider(chain)) {
      return false;
    }
    return this.providerFactory.getProvider(chain).validateAddress(address);
  }

  async createAddress(input: CreateAddressInput): Promise<ChainAddressRecord> {
    const network = await this.networkConfig.findByChain(input.chain);
    if (!network || !network.isEnabled) {
      throw new ValidationError(`Chain ${input.chain} is not enabled`);
    }

    const provider = this.providerFactory.getProvider(input.chain);
    const generated = await provider.createAddress();

    const created = await this.addresses.create({
      chain: input.chain,
      networkId: network.id,
      walletId: input.walletId ?? null,
      ownerUserId: input.ownerUserId,
      address: generated.address,
      label: input.label ?? null,
      metadata: generated.metadata as Prisma.InputJsonValue | undefined,
    });

    const activated = await this.addresses.setStatus(created.id, ChainAddressStatus.ACTIVE);
    await provider.watchAddress(activated.address);

    await this.eventBus.publish({
      type: BlockchainEventType.AddressCreated,
      chain: input.chain,
      aggregateId: activated.id,
      payload: { address: activated.address, ownerUserId: activated.ownerUserId },
    });

    return activated;
  }

  async listAddressesForUser(
    ownerUserId: string,
    requester: JwtAccessClaims,
    filters: { chain?: ChainNetwork; status?: ChainAddressStatus; skip?: number; take?: number },
  ): Promise<{ items: ChainAddressRecord[]; total: number }> {
    if (ownerUserId !== requester.sub && !this.hasAdminPermission(requester)) {
      throw new ForbiddenError('Access denied');
    }
    return this.addresses.list({ ...filters, ownerUserId });
  }

  async adminListAddresses(
    filters: ChainAddressFilters,
  ): Promise<{ items: ChainAddressRecord[]; total: number }> {
    return this.addresses.list(filters);
  }

  async getAddress(id: string, requester: JwtAccessClaims): Promise<ChainAddressRecord> {
    const address = await this.requireAddress(id);
    this.assertOwnershipOrAdmin(address, requester);
    return address;
  }

  async updateAddress(
    id: string,
    input: UpdateAddressInput,
    requester: JwtAccessClaims,
  ): Promise<ChainAddressRecord> {
    const address = await this.requireAddress(id);
    this.assertOwnershipOrAdmin(address, requester);
    return this.addresses.update(id, {
      label: input.label,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    });
  }

  async activate(id: string, requester: JwtAccessClaims): Promise<ChainAddressRecord> {
    const address = await this.requireAddress(id);
    this.assertOwnershipOrAdmin(address, requester);
    return this.addresses.setStatus(id, ChainAddressStatus.ACTIVE);
  }

  async archive(id: string, requester: JwtAccessClaims): Promise<ChainAddressRecord> {
    const address = await this.requireAddress(id);
    this.assertOwnershipOrAdmin(address, requester);
    if (address.isPrimary) {
      throw new ValidationError('Cannot archive the primary address; set another address as primary first');
    }
    return this.addresses.setStatus(id, ChainAddressStatus.ARCHIVED);
  }

  async setPrimary(id: string, requester: JwtAccessClaims): Promise<ChainAddressRecord> {
    const address = await this.requireAddress(id);
    this.assertOwnershipOrAdmin(address, requester);
    if (address.status !== ChainAddressStatus.ACTIVE) {
      throw new ValidationError('Only active addresses can be marked as primary');
    }
    return this.addresses.setPrimary(id, address.ownerUserId, address.chain);
  }

  async getBalance(chain: ChainNetwork, address: string): Promise<{ chain: ChainNetwork; address: string; balance: string }> {
    if (!this.providerFactory.hasProvider(chain)) {
      throw new NotFoundError(`Unsupported chain ${chain}`);
    }
    const provider = this.providerFactory.getProvider(chain);
    const balance = await provider.getBalance(address);
    return { chain, address, balance };
  }

  async getNetworkStats(chain: ChainNetwork): Promise<NetworkStats> {
    const config = await this.networkConfig.findByChain(chain);
    if (!config) {
      throw new NotFoundError(`Unsupported chain ${chain}`);
    }
    const provider = this.providerFactory.getProvider(chain);
    const status = await provider.getNetworkStatus();
    return {
      config,
      blockHeight: status.blockHeight.toString(),
      healthy: status.healthy,
      latencyMs: status.latencyMs,
    };
  }

  private async requireAddress(id: string): Promise<ChainAddressRecord> {
    const address = await this.addresses.findById(id);
    if (!address) {
      throw new NotFoundError('Chain address not found');
    }
    return address;
  }

  private assertOwnershipOrAdmin(address: ChainAddressRecord, requester: JwtAccessClaims): void {
    if (address.ownerUserId !== requester.sub && !this.hasAdminPermission(requester)) {
      throw new ForbiddenError('Access denied');
    }
  }

  private hasAdminPermission(requester: JwtAccessClaims): boolean {
    return requester.permissions.includes(PERMISSION_BLOCKCHAIN_ADMIN as PermissionCode);
  }
}
