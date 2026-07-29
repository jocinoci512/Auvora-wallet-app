import { ChainNetwork } from '@auvora/database';
import { SimulatorStakingProvider } from './simulator-staking.provider';

describe('staking failure recovery', () => {
  const provider = new SimulatorStakingProvider();

  it('marks operations failed without throwing status lookup', async () => {
    const ref = 'fail-ref-1';
    provider.failOperation(ref, 'simulated failure');
    const status = await provider.getOperationStatus(ref);
    expect(status.status).toBe('FAILED');
    expect(status.errorMessage).toBe('simulated failure');
  });

  it('returns null for unknown validators', async () => {
    await expect(provider.getValidator(ChainNetwork.ETHEREUM, 'missing')).resolves.toBeNull();
  });
});
