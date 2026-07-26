import { Inject, Injectable } from '@nestjs/common';
import { type ChainNetwork, PrismaService } from '@auvora/database';
import type {
  NetworkConfigRecord,
  NetworkConfigRepositoryPort,
} from '../../application/ports/network-config-repository.port';

function mapNetworkConfig(record: {
  id: string;
  chain: ChainNetwork;
  displayName: string;
  isEnabled: boolean;
  requiredConfirmations: number;
  blockTimeSeconds: number;
  nativeSymbol: string;
  explorerUrl: string | null;
  rpcUrl: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): NetworkConfigRecord {
  return {
    id: record.id,
    chain: record.chain,
    displayName: record.displayName,
    isEnabled: record.isEnabled,
    requiredConfirmations: record.requiredConfirmations,
    blockTimeSeconds: record.blockTimeSeconds,
    nativeSymbol: record.nativeSymbol,
    explorerUrl: record.explorerUrl,
    rpcUrl: record.rpcUrl,
    metadata: record.metadata as NetworkConfigRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaNetworkConfigRepository implements NetworkConfigRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByChain(chain: ChainNetwork): Promise<NetworkConfigRecord | null> {
    const record = await this.prisma.blockchainNetworkConfig.findUnique({ where: { chain } });
    return record ? mapNetworkConfig(record) : null;
  }

  async listAll(): Promise<NetworkConfigRecord[]> {
    const records = await this.prisma.blockchainNetworkConfig.findMany({
      orderBy: { displayName: 'asc' },
    });
    return records.map(mapNetworkConfig);
  }

  async listEnabled(): Promise<NetworkConfigRecord[]> {
    const records = await this.prisma.blockchainNetworkConfig.findMany({
      where: { isEnabled: true },
      orderBy: { displayName: 'asc' },
    });
    return records.map(mapNetworkConfig);
  }
}
