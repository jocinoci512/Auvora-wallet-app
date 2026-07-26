import type { ChainNetwork, ChainTxDirection, ChainTxStatus, Prisma } from '@auvora/database';

export const CHAIN_TRANSACTION_REPOSITORY = Symbol('CHAIN_TRANSACTION_REPOSITORY');

export interface ChainTransactionRecord {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  addressId: string | null;
  txHash: string;
  direction: ChainTxDirection;
  status: ChainTxStatus;
  amount: string;
  feeAmount: string;
  fromAddress: string | null;
  toAddress: string | null;
  blockNumber: string | null;
  confirmations: number;
  requiredConfirmations: number;
  broadcastAt: Date | null;
  confirmedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChainTransactionData {
  chain: ChainNetwork;
  networkId: string;
  addressId?: string | null;
  txHash: string;
  direction: ChainTxDirection;
  status?: ChainTxStatus;
  amount: string;
  feeAmount?: string;
  fromAddress?: string | null;
  toAddress?: string | null;
  requiredConfirmations: number;
  metadata?: Prisma.InputJsonValue;
  rawPayload?: Prisma.InputJsonValue;
  broadcastAt?: Date;
}

export interface ChainTransactionFilters {
  chain?: ChainNetwork;
  status?: ChainTxStatus;
  statuses?: ChainTxStatus[];
  addressId?: string;
  ownerUserId?: string;
  skip?: number;
  take?: number;
}

export interface UpdateStatusData {
  failureReason?: string;
  confirmedAt?: Date;
  failedAt?: Date;
  broadcastAt?: Date;
}

export interface ChainTransactionRepositoryPort {
  create(data: CreateChainTransactionData): Promise<ChainTransactionRecord>;
  findById(id: string): Promise<ChainTransactionRecord | null>;
  findByChainTxHash(chain: ChainNetwork, txHash: string): Promise<ChainTransactionRecord | null>;
  findByIdOrHash(idOrHash: string): Promise<ChainTransactionRecord | null>;
  list(filters: ChainTransactionFilters): Promise<{ items: ChainTransactionRecord[]; total: number }>;
  updateStatus(id: string, status: ChainTxStatus, data?: UpdateStatusData): Promise<ChainTransactionRecord>;
  updateConfirmations(
    id: string,
    confirmations: number,
    blockNumber?: string | null,
  ): Promise<ChainTransactionRecord>;
  findActiveByChain(chain: ChainNetwork): Promise<ChainTransactionRecord[]>;
}
