import type { ChainNetwork } from '@auvora/database';

export type StakingNetworkCapability = {
  network: ChainNetwork;
  stakingSupported: boolean;
  assets: string[];
  reason?: string;
};

export type ValidatorSnapshot = {
  network: ChainNetwork;
  validatorId: string;
  name: string;
  address: string;
  status: 'ACTIVE' | 'JAILED' | 'INACTIVE';
  commissionPercent: number;
  apyPercent: number;
  uptimePercent: number;
  totalDelegated: string;
  delegatorCount: number;
  performanceScore: number;
};

export type PreparedStakingTx = {
  providerCode: string;
  network: ChainNetwork;
  operation: 'STAKE' | 'UNSTAKE' | 'CLAIM';
  to: string;
  data: string;
  value: string;
  assetSymbol: string;
  amount: string;
  validatorId: string;
  estimatedCompletionSeconds: number;
  simulationOk: boolean;
  simulationDetail?: string;
};

export type StakingOpStatus = {
  providerRef: string;
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMING' | 'COMPLETED' | 'FAILED';
  txHash?: string;
  errorMessage?: string;
  amountActual?: string;
  rewardsActual?: string;
};

export type RewardEstimate = {
  network: ChainNetwork;
  assetSymbol: string;
  validatorId: string;
  principal: string;
  apyPercent: number;
  pendingRewards: string;
  projectedDaily: string;
  projectedMonthly: string;
  projectedYearly: string;
};

export const STAKING_PROVIDER = Symbol('STAKING_PROVIDER');

export interface StakingProviderPort {
  readonly code: string;
  readonly name: string;
  getSupportedNetworks(): StakingNetworkCapability[];
  listValidators(network: ChainNetwork, query?: string): Promise<ValidatorSnapshot[]>;
  getValidator(network: ChainNetwork, validatorId: string): Promise<ValidatorSnapshot | null>;
  estimateRewards(input: {
    network: ChainNetwork;
    assetSymbol: string;
    amount: string;
    validatorId: string;
  }): Promise<RewardEstimate>;
  prepareStake(input: {
    network: ChainNetwork;
    assetSymbol: string;
    amount: string;
    validatorId: string;
    userAddress: string;
  }): Promise<PreparedStakingTx>;
  prepareUnstake(input: {
    network: ChainNetwork;
    assetSymbol: string;
    amount: string;
    validatorId: string;
    userAddress: string;
    positionRef?: string;
  }): Promise<PreparedStakingTx>;
  prepareClaim(input: {
    network: ChainNetwork;
    assetSymbol: string;
    validatorId: string;
    userAddress: string;
    positionRef?: string;
  }): Promise<PreparedStakingTx>;
  getOperationStatus(providerRef: string): Promise<StakingOpStatus>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; detail?: string }>;
}
