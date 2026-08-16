import { networkLabel, resolveNetwork, SUPPORTED_NETWORKS } from './networks';

describe('supported networks', () => {
  it('covers the six live chains only', () => {
    expect(SUPPORTED_NETWORKS.map((n) => n.label)).toEqual([
      'Bitcoin',
      'Ethereum',
      'Solana',
      'BNB Smart Chain',
      'Polygon',
      'Tron',
    ]);
  });

  it('resolves common aliases without inventing chains', () => {
    expect(resolveNetwork('ETH')?.id).toBe('ethereum');
    expect(resolveNetwork('BNB_SMART_CHAIN')?.id).toBe('bnb');
    expect(resolveNetwork('matic')?.label).toBe('Polygon');
    expect(networkLabel('solana')).toBe('Solana');
    expect(resolveNetwork('avalanche')).toBeNull();
  });
});
