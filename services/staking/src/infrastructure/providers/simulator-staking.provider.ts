import { Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import {
  formatAmount,
  parseAmount,
  projectedEarnings,
  validatorRankScore,
} from '../../domain/calculations';
import { StakingUnsupportedNetworkError } from '../../domain/errors';
import type {
  PreparedStakingTx,
  RewardEstimate,
  StakingNetworkCapability,
  StakingOpStatus,
  StakingProviderPort,
  ValidatorSnapshot,
} from '../../domain/staking-provider.port';

const VALIDATORS: ValidatorSnapshot[] = [
  {
    network: ChainNetwork.ETHEREUM,
    validatorId: 'eth-lido-sim',
    name: 'Auvora ETH Validator A',
    address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    status: 'ACTIVE',
    commissionPercent: 5,
    apyPercent: 3.8,
    uptimePercent: 99.7,
    totalDelegated: '125000',
    delegatorCount: 420,
    performanceScore: 0,
  },
  {
    network: ChainNetwork.ETHEREUM,
    validatorId: 'eth-rocket-sim',
    name: 'Auvora ETH Validator B',
    address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    status: 'ACTIVE',
    commissionPercent: 8,
    apyPercent: 3.5,
    uptimePercent: 99.2,
    totalDelegated: '88000',
    delegatorCount: 210,
    performanceScore: 0,
  },
  {
    network: ChainNetwork.SOLANA,
    validatorId: 'sol-auvora-1',
    name: 'Auvora SOL Validator',
    address: 'So11111111111111111111111111111111111111112',
    status: 'ACTIVE',
    commissionPercent: 7,
    apyPercent: 6.4,
    uptimePercent: 99.9,
    totalDelegated: '540000',
    delegatorCount: 980,
    performanceScore: 0,
  },
  {
    network: ChainNetwork.BNB_SMART_CHAIN,
    validatorId: 'bsc-auvora-1',
    name: 'Auvora BSC Validator',
    address: '0xcccccccccccccccccccccccccccccccccccccccc',
    status: 'ACTIVE',
    commissionPercent: 10,
    apyPercent: 5.1,
    uptimePercent: 98.8,
    totalDelegated: '210000',
    delegatorCount: 150,
    performanceScore: 0,
  },
  {
    network: ChainNetwork.TRON,
    validatorId: 'trx-auvora-1',
    name: 'Auvora TRX SR',
    address: 'TAuvoraSuperRepresentative111111111111',
    status: 'ACTIVE',
    commissionPercent: 12,
    apyPercent: 4.2,
    uptimePercent: 99.0,
    totalDelegated: '99000',
    delegatorCount: 75,
    performanceScore: 0,
  },
];

for (const v of VALIDATORS) {
  v.performanceScore = validatorRankScore({
    apyPercent: v.apyPercent,
    uptimePercent: v.uptimePercent,
    commissionPercent: v.commissionPercent,
  });
}

const OPS = new Map<string, StakingOpStatus>();

@Injectable()
export class SimulatorStakingProvider implements StakingProviderPort {
  readonly code = 'simulator';
  readonly name = 'Staking Simulator';

  getSupportedNetworks(): StakingNetworkCapability[] {
    return [
      { network: ChainNetwork.ETHEREUM, stakingSupported: true, assets: ['ETH'] },
      { network: ChainNetwork.SOLANA, stakingSupported: true, assets: ['SOL'] },
      { network: ChainNetwork.BNB_SMART_CHAIN, stakingSupported: true, assets: ['BNB'] },
      { network: ChainNetwork.TRON, stakingSupported: true, assets: ['TRX'] },
      {
        network: ChainNetwork.BITCOIN,
        stakingSupported: false,
        assets: [],
        reason: 'Native staking not available; future extensibility reserved',
      },
    ];
  }

  async listValidators(network: ChainNetwork, query?: string): Promise<ValidatorSnapshot[]> {
    this.assertSupported(network);
    const q = (query ?? '').toLowerCase();
    return VALIDATORS.filter(
      (v) =>
        v.network === network &&
        (!q ||
          v.name.toLowerCase().includes(q) ||
          v.validatorId.toLowerCase().includes(q) ||
          v.address.toLowerCase().includes(q)),
    ).sort((a, b) => b.performanceScore - a.performanceScore);
  }

  async getValidator(network: ChainNetwork, validatorId: string) {
    return VALIDATORS.find((v) => v.network === network && v.validatorId === validatorId) ?? null;
  }

  async estimateRewards(input: {
    network: ChainNetwork;
    assetSymbol: string;
    amount: string;
    validatorId: string;
  }): Promise<RewardEstimate> {
    this.assertSupported(input.network);
    const validator = await this.getValidator(input.network, input.validatorId);
    if (!validator) throw new StakingUnsupportedNetworkError(input.network, 'Unknown validator');
    const principal = parseAmount(input.amount);
    const apy = validator.apyPercent;
    const pending = projectedEarnings(principal, apy, 1);
    return {
      network: input.network,
      assetSymbol: input.assetSymbol,
      validatorId: input.validatorId,
      principal: input.amount,
      apyPercent: apy,
      pendingRewards: formatAmount(pending),
      projectedDaily: formatAmount(projectedEarnings(principal, apy, 1)),
      projectedMonthly: formatAmount(projectedEarnings(principal, apy, 30)),
      projectedYearly: formatAmount(projectedEarnings(principal, apy, 365)),
    };
  }

  async prepareStake(input: {
    network: ChainNetwork;
    assetSymbol: string;
    amount: string;
    validatorId: string;
    userAddress: string;
  }): Promise<PreparedStakingTx> {
    this.assertSupported(input.network);
    const validator = await this.getValidator(input.network, input.validatorId);
    if (!validator || validator.status !== 'ACTIVE') {
      throw new StakingUnsupportedNetworkError(input.network, 'Validator unavailable');
    }
    parseAmount(input.amount);
    return {
      providerCode: this.code,
      network: input.network,
      operation: 'STAKE',
      to: validator.address,
      data: `stake:${input.validatorId}:${input.amount}`,
      value: input.amount,
      assetSymbol: input.assetSymbol,
      amount: input.amount,
      validatorId: input.validatorId,
      estimatedCompletionSeconds: 120,
      simulationOk: true,
      simulationDetail: 'simulated stake ok',
    };
  }

  async prepareUnstake(input: {
    network: ChainNetwork;
    assetSymbol: string;
    amount: string;
    validatorId: string;
    userAddress: string;
    positionRef?: string;
  }): Promise<PreparedStakingTx> {
    this.assertSupported(input.network);
    parseAmount(input.amount);
    const validator = await this.getValidator(input.network, input.validatorId);
    if (!validator) throw new StakingUnsupportedNetworkError(input.network, 'Unknown validator');
    return {
      providerCode: this.code,
      network: input.network,
      operation: 'UNSTAKE',
      to: validator.address,
      data: `unstake:${input.validatorId}:${input.amount}:${input.positionRef ?? ''}`,
      value: '0',
      assetSymbol: input.assetSymbol,
      amount: input.amount,
      validatorId: input.validatorId,
      estimatedCompletionSeconds: 86_400,
      simulationOk: true,
      simulationDetail: 'simulated unstake ok',
    };
  }

  async prepareClaim(input: {
    network: ChainNetwork;
    assetSymbol: string;
    validatorId: string;
    userAddress: string;
    positionRef?: string;
  }): Promise<PreparedStakingTx> {
    this.assertSupported(input.network);
    const validator = await this.getValidator(input.network, input.validatorId);
    if (!validator) throw new StakingUnsupportedNetworkError(input.network, 'Unknown validator');
    return {
      providerCode: this.code,
      network: input.network,
      operation: 'CLAIM',
      to: validator.address,
      data: `claim:${input.validatorId}:${input.positionRef ?? ''}`,
      value: '0',
      assetSymbol: input.assetSymbol,
      amount: '0',
      validatorId: input.validatorId,
      estimatedCompletionSeconds: 60,
      simulationOk: true,
      simulationDetail: 'simulated claim ok',
    };
  }

  async getOperationStatus(providerRef: string): Promise<StakingOpStatus> {
    const existing = OPS.get(providerRef);
    if (existing) return existing;
    const status: StakingOpStatus = {
      providerRef,
      status: 'COMPLETED',
      txHash: `0xsim${providerRef.replace(/-/g, '').slice(0, 16)}`,
      amountActual: undefined,
    };
    OPS.set(providerRef, status);
    return status;
  }

  async healthCheck() {
    const started = Date.now();
    return { healthy: true, latencyMs: Date.now() - started, detail: 'simulator ok' };
  }

  /** Test helper — force a failed op for recovery tests */
  failOperation(providerRef: string, message: string) {
    OPS.set(providerRef, { providerRef, status: 'FAILED', errorMessage: message });
  }

  private assertSupported(network: ChainNetwork) {
    const cap = this.getSupportedNetworks().find((n) => n.network === network);
    if (!cap?.stakingSupported) {
      throw new StakingUnsupportedNetworkError(network, cap?.reason);
    }
  }
}

export function simulatorEstimatedApyBps(apyPercent: number): number {
  return Math.round(apyPercent * 100);
}
