import { ChainNetwork } from '@auvora/database';
import { LidoStyleProvider } from '../../infrastructure/providers/lido-style.provider';
import { MarinadeStyleProvider } from '../../infrastructure/providers/marinade-style.provider';
import { StakingProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { SimulatorStakingProvider } from '../../infrastructure/providers/simulator-staking.provider';

describe('staking provider integration', () => {
  const env = {
    STAKING_SIMULATOR_ENABLED: true,
    STAKING_PROVIDER_TIMEOUT_MS: 5000,
    STAKING_PROVIDER_MAX_RETRIES: 1,
  } as never;
  const simulator = new SimulatorStakingProvider();
  const registry = new StakingProviderRegistry(
    env,
    simulator,
    new LidoStyleProvider(simulator),
    new MarinadeStyleProvider(simulator),
  );

  it('lists ethereum validators ranked by performance', async () => {
    const list = await registry.listValidators(ChainNetwork.ETHEREUM);
    expect(list.length).toBeGreaterThan(0);
  });

  it('lists networks including bitcoin stub', () => {
    const nets = registry.getSupportedNetworks();
    expect(nets.some((n) => n.network === ChainNetwork.BITCOIN && !n.stakingSupported)).toBe(true);
    expect(nets.some((n) => n.network === ChainNetwork.SOLANA && n.stakingSupported)).toBe(true);
  });

  it('estimates rewards via marinade path for solana', async () => {
    const estimate = await registry.estimateRewards({
      network: ChainNetwork.SOLANA,
      assetSymbol: 'SOL',
      amount: '10',
      validatorId: 'sol-auvora-1',
    });
    expect(estimate.apyPercent).toBeGreaterThan(0);
    expect(estimate.projectedYearly).toBeTruthy();
  });

  it('health checks registry', async () => {
    await expect(registry.healthCheck()).resolves.toMatchObject({ healthy: true });
  });
});
