import { Inject, Injectable } from '@nestjs/common';
import { ChainNetwork, PrismaService } from '@auvora/database';
import {
  NETWORK_CONFIG_REPOSITORY,
  type NetworkConfigRepositoryPort,
} from '../../application/ports/network-config-repository.port';
import {
  SIMULATOR_LEDGER,
  type SimulatorLedgerPort,
} from '../../application/ports/simulator-ledger.port';
import { validateAddressForChain } from '../../domain';
import { generateEvmAddress } from './address-crypto.util';
import { BaseSimulatorProvider } from './base-simulator.provider';

@Injectable()
export class PolygonProvider extends BaseSimulatorProvider {
  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(NETWORK_CONFIG_REPOSITORY) networkConfig: NetworkConfigRepositoryPort,
    @Inject(SIMULATOR_LEDGER) ledger: SimulatorLedgerPort,
  ) {
    super(prisma, networkConfig, ledger, ChainNetwork.POLYGON);
  }

  async createAddress(): Promise<{ address: string; metadata?: Record<string, unknown> }> {
    const generated = generateEvmAddress();
    return { address: generated.address, metadata: { publicKey: generated.publicKey } };
  }

  validateAddress(address: string): boolean {
    return validateAddressForChain(ChainNetwork.POLYGON, address);
  }

  protected defaultFee(): { base: string; unit: string } {
    return { base: '0.01', unit: 'MATIC' };
  }
}
