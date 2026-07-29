import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { StakingProviderError, StakingUnsupportedNetworkError } from '../../domain/errors';
import type {
  PreparedStakingTx,
  RewardEstimate,
  StakingNetworkCapability,
  StakingOpStatus,
  StakingProviderPort,
  ValidatorSnapshot,
} from '../../domain/staking-provider.port';
import { LidoStyleProvider } from './lido-style.provider';
import { MarinadeStyleProvider } from './marinade-style.provider';
import { SimulatorStakingProvider } from './simulator-staking.provider';

@Injectable()
export class StakingProviderRegistry implements StakingProviderPort {
  readonly code = 'registry';
  readonly name = 'Staking Provider Registry';
  private readonly logger = new Logger(StakingProviderRegistry.name);
  private readonly providers: StakingProviderPort[];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(SimulatorStakingProvider) simulator: SimulatorStakingProvider,
    @Inject(LidoStyleProvider) lido: LidoStyleProvider,
    @Inject(MarinadeStyleProvider) marinade: MarinadeStyleProvider,
  ) {
    this.providers = env.STAKING_SIMULATOR_ENABLED ? [simulator, lido, marinade] : [lido, marinade];
  }

  listProviders(): Array<{ code: string; name: string }> {
    return this.providers.map((p) => ({ code: p.code, name: p.name }));
  }

  getProvider(code: string): StakingProviderPort {
    const found = this.providers.find((p) => p.code === code);
    if (!found) throw new StakingProviderError(`Unknown staking provider: ${code}`);
    return found;
  }

  getSupportedNetworks(): StakingNetworkCapability[] {
    const map = new Map<ChainNetwork, StakingNetworkCapability>();
    for (const provider of this.providers) {
      for (const cap of provider.getSupportedNetworks()) {
        const existing = map.get(cap.network);
        if (!existing) {
          map.set(cap.network, { ...cap, assets: [...cap.assets] });
        } else if (cap.stakingSupported) {
          map.set(cap.network, {
            network: cap.network,
            stakingSupported: true,
            assets: Array.from(new Set([...existing.assets, ...cap.assets])),
          });
        }
      }
    }
    if (!map.has(ChainNetwork.BITCOIN)) {
      map.set(ChainNetwork.BITCOIN, {
        network: ChainNetwork.BITCOIN,
        stakingSupported: false,
        assets: [],
        reason: 'Native staking not available; future extensibility reserved',
      });
    }
    return Array.from(map.values());
  }

  private providersFor(network: ChainNetwork): StakingProviderPort[] {
    return this.providers.filter((p) =>
      p.getSupportedNetworks().some((n) => n.network === network && n.stakingSupported),
    );
  }

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new StakingProviderError('Provider timeout')),
            this.env.STAKING_PROVIDER_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async listValidators(network: ChainNetwork, query?: string): Promise<ValidatorSnapshot[]> {
    const providers = this.providersFor(network);
    if (!providers.length) {
      const cap = this.getSupportedNetworks().find((n) => n.network === network);
      throw new StakingUnsupportedNetworkError(network, cap?.reason);
    }
    const merged = new Map<string, ValidatorSnapshot>();
    for (const provider of providers) {
      try {
        const list = await this.withTimeout(() => provider.listValidators(network, query));
        for (const v of list) merged.set(v.validatorId, v);
      } catch (error) {
        this.logger.warn(
          `listValidators ${provider.code}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return Array.from(merged.values()).sort((a, b) => b.performanceScore - a.performanceScore);
  }

  async getValidator(network: ChainNetwork, validatorId: string) {
    for (const provider of this.providersFor(network)) {
      const found = await provider.getValidator(network, validatorId);
      if (found) return found;
    }
    return null;
  }

  async estimateRewards(input: {
    network: ChainNetwork;
    assetSymbol: string;
    amount: string;
    validatorId: string;
  }): Promise<RewardEstimate> {
    const providers = this.providersFor(input.network);
    if (!providers.length) throw new StakingUnsupportedNetworkError(input.network);
    let lastError: unknown;
    for (const provider of providers) {
      try {
        return await this.withTimeout(() => provider.estimateRewards(input));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new StakingProviderError('Reward estimation failed');
  }

  async prepareStake(
    input: Parameters<StakingProviderPort['prepareStake']>[0],
  ): Promise<PreparedStakingTx> {
    return this.prepare('prepareStake', input);
  }

  async prepareUnstake(
    input: Parameters<StakingProviderPort['prepareUnstake']>[0],
  ): Promise<PreparedStakingTx> {
    return this.prepare('prepareUnstake', input);
  }

  async prepareClaim(
    input: Parameters<StakingProviderPort['prepareClaim']>[0],
  ): Promise<PreparedStakingTx> {
    return this.prepare('prepareClaim', input);
  }

  private async prepare<K extends 'prepareStake' | 'prepareUnstake' | 'prepareClaim'>(
    method: K,
    input: Parameters<StakingProviderPort[K]>[0],
  ): Promise<PreparedStakingTx> {
    const network = input.network;
    const providers = this.providersFor(network);
    if (!providers.length) throw new StakingUnsupportedNetworkError(network);
    let lastError: unknown;
    for (const provider of providers) {
      try {
        return await this.withTimeout(() =>
          (provider[method] as (arg: typeof input) => Promise<PreparedStakingTx>)(input),
        );
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new StakingProviderError(`${method} failed`);
  }

  async getOperationStatus(providerRef: string): Promise<StakingOpStatus> {
    for (const provider of this.providers) {
      try {
        return await provider.getOperationStatus(providerRef);
      } catch {
        /* try next */
      }
    }
    throw new StakingProviderError('Operation status unavailable');
  }

  async healthCheck() {
    const started = Date.now();
    const checks = await Promise.all(this.providers.map((p) => p.healthCheck()));
    return {
      healthy: checks.every((c) => c.healthy),
      latencyMs: Date.now() - started,
      detail: checks
        .map((c, i) => `${this.providers[i]?.code ?? 'unknown'}:${c.healthy}`)
        .join(','),
    };
  }
}
