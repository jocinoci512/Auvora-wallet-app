import { Inject, Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { StakingUnsupportedNetworkError } from '../../domain/errors';
import type {
  StakingNetworkCapability,
  StakingProviderPort,
} from '../../domain/staking-provider.port';
import { SimulatorStakingProvider } from './simulator-staking.provider';

/** Solana stake-pool style adapter (simulated Marinade-like). */
@Injectable()
export class MarinadeStyleProvider implements StakingProviderPort {
  readonly code = 'marinade_sim';
  readonly name = 'Marinade-style Staking (sim)';

  constructor(
    @Inject(SimulatorStakingProvider) private readonly simulator: SimulatorStakingProvider,
  ) {}

  getSupportedNetworks(): StakingNetworkCapability[] {
    return [
      { network: ChainNetwork.SOLANA, stakingSupported: true, assets: ['SOL'] },
      {
        network: ChainNetwork.ETHEREUM,
        stakingSupported: false,
        assets: [],
        reason: 'Solana-only',
      },
      {
        network: ChainNetwork.BNB_SMART_CHAIN,
        stakingSupported: false,
        assets: [],
        reason: 'Solana-only',
      },
      { network: ChainNetwork.TRON, stakingSupported: false, assets: [], reason: 'Solana-only' },
      { network: ChainNetwork.BITCOIN, stakingSupported: false, assets: [], reason: 'Solana-only' },
    ];
  }

  async listValidators(network: ChainNetwork, query?: string) {
    if (network !== ChainNetwork.SOLANA) return [];
    return this.simulator.listValidators(network, query);
  }

  async getValidator(network: ChainNetwork, validatorId: string) {
    if (network !== ChainNetwork.SOLANA) return null;
    return this.simulator.getValidator(network, validatorId);
  }

  async estimateRewards(input: Parameters<StakingProviderPort['estimateRewards']>[0]) {
    if (input.network !== ChainNetwork.SOLANA) {
      throw new StakingUnsupportedNetworkError(input.network, 'Solana-only provider');
    }
    return this.simulator.estimateRewards(input);
  }

  async prepareStake(input: Parameters<StakingProviderPort['prepareStake']>[0]) {
    if (input.network !== ChainNetwork.SOLANA) {
      throw new StakingUnsupportedNetworkError(input.network);
    }
    const tx = await this.simulator.prepareStake(input);
    return { ...tx, providerCode: this.code };
  }

  async prepareUnstake(input: Parameters<StakingProviderPort['prepareUnstake']>[0]) {
    if (input.network !== ChainNetwork.SOLANA) {
      throw new StakingUnsupportedNetworkError(input.network);
    }
    const tx = await this.simulator.prepareUnstake(input);
    return { ...tx, providerCode: this.code };
  }

  async prepareClaim(input: Parameters<StakingProviderPort['prepareClaim']>[0]) {
    if (input.network !== ChainNetwork.SOLANA) {
      throw new StakingUnsupportedNetworkError(input.network);
    }
    const tx = await this.simulator.prepareClaim(input);
    return { ...tx, providerCode: this.code };
  }

  async getOperationStatus(providerRef: string) {
    return this.simulator.getOperationStatus(providerRef);
  }

  async healthCheck() {
    const base = await this.simulator.healthCheck();
    return { ...base, detail: 'marinade_sim ok' };
  }
}
