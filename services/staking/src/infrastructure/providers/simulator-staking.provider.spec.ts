import { ChainNetwork } from '@auvora/database';
import { SimulatorStakingProvider } from './simulator-staking.provider';

describe('SimulatorStakingProvider', () => {
  const provider = new SimulatorStakingProvider();

  it('lists supported networks and bitcoin stub', () => {
    const nets = provider.getSupportedNetworks();
    expect(nets.some((n) => n.network === ChainNetwork.ETHEREUM && n.stakingSupported)).toBe(true);
    expect(nets.some((n) => n.network === ChainNetwork.BITCOIN && !n.stakingSupported)).toBe(true);
  });

  it('ranks validators for ethereum', async () => {
    const list = await provider.listValidators(ChainNetwork.ETHEREUM);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].performanceScore).toBeGreaterThanOrEqual(list[list.length - 1].performanceScore);
  });

  it('prepares stake with simulationOk', async () => {
    const tx = await provider.prepareStake({
      network: ChainNetwork.ETHEREUM,
      assetSymbol: 'ETH',
      amount: '1.0',
      validatorId: 'eth-lido-sim',
      userAddress: '0x1111111111111111111111111111111111111111',
    });
    expect(tx.simulationOk).toBe(true);
    expect(tx.operation).toBe('STAKE');
  });

  it('rejects bitcoin staking gracefully', async () => {
    await expect(provider.listValidators(ChainNetwork.BITCOIN)).rejects.toMatchObject({
      code: 'STAKING_UNSUPPORTED_NETWORK',
    });
  });
});
