import { Inject, Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { StakingUnsupportedNetworkError } from '../../domain/errors';
import type {
  StakingNetworkCapability,
  StakingProviderPort,
} from '../../domain/staking-provider.port';
import { SimulatorStakingProvider } from './simulator-staking.provider';

/** EVM liquid-staking style adapter (simulated Lido-like). */
@Injectable()
export class LidoStyleProvider implements StakingProviderPort {
  readonly code = 'lido_sim';
  readonly name = 'Lido-style Staking (sim)';

  constructor(
    @Inject(SimulatorStakingProvider) private readonly simulator: SimulatorStakingProvider,
  ) {}

  getSupportedNetworks(): StakingNetworkCapability[] {
    return [
      { network: ChainNetwork.ETHEREUM, stakingSupported: true, assets: ['ETH'] },
      {
        network: ChainNetwork.BNB_SMART_CHAIN,
        stakingSupported: false,
        assets: [],
        reason: 'ETH liquid staking adapter',
      },
      { network: ChainNetwork.SOLANA, stakingSupported: false, assets: [], reason: 'ETH-only' },
      { network: ChainNetwork.TRON, stakingSupported: false, assets: [], reason: 'ETH-only' },
      { network: ChainNetwork.BITCOIN, stakingSupported: false, assets: [], reason: 'ETH-only' },
    ];
  }

  async listValidators(network: ChainNetwork, query?: string) {
    if (network !== ChainNetwork.ETHEREUM) return [];
    return this.simulator.listValidators(network, query);
  }

  async getValidator(network: ChainNetwork, validatorId: string) {
    if (network !== ChainNetwork.ETHEREUM) return null;
    return this.simulator.getValidator(network, validatorId);
  }

  async estimateRewards(input: Parameters<StakingProviderPort['estimateRewards']>[0]) {
    if (input.network !== ChainNetwork.ETHEREUM) {
      throw new StakingUnsupportedNetworkError(input.network, 'ETH-only provider');
    }
    return this.simulator.estimateRewards(input);
  }

  async prepareStake(input: Parameters<StakingProviderPort['prepareStake']>[0]) {
    if (input.network !== ChainNetwork.ETHEREUM) {
      throw new StakingUnsupportedNetworkError(input.network);
    }
    const tx = await this.simulator.prepareStake(input);
    return { ...tx, providerCode: this.code };
  }

  async prepareUnstake(input: Parameters<StakingProviderPort['prepareUnstake']>[0]) {
    if (input.network !== ChainNetwork.ETHEREUM) {
      throw new StakingUnsupportedNetworkError(input.network);
    }
    const tx = await this.simulator.prepareUnstake(input);
    return { ...tx, providerCode: this.code };
  }

  async prepareClaim(input: Parameters<StakingProviderPort['prepareClaim']>[0]) {
    if (input.network !== ChainNetwork.ETHEREUM) {
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
    return { ...base, detail: 'lido_sim ok' };
  }
}
