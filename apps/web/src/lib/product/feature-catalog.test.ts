import {
  FEATURE_CATALOG,
  featureById,
  statusLabel,
  SUPPORTED_CHAINS_LIVE,
} from './feature-catalog';

describe('feature-catalog', () => {
  it('marks NFT and live broadcast as ABSENT', () => {
    expect(featureById('nft')?.status).toBe('ABSENT');
    expect(featureById('live-broadcast')?.status).toBe('ABSENT');
  });

  it('keeps supported live chains to BTC/ETH/SOL/BNB/POL/TRX', () => {
    expect(SUPPORTED_CHAINS_LIVE.map((c) => c.code)).toEqual([
      'BTC',
      'ETH',
      'SOL',
      'BNB',
      'POL',
      'TRX',
    ]);
  });

  it('classifies swap/staking/hardware as COMING_SOON', () => {
    expect(featureById('swap')?.status).toBe('COMING_SOON');
    expect(featureById('staking')?.status).toBe('COMING_SOON');
    expect(featureById('hardware')?.status).toBe('COMING_SOON');
  });

  it('exposes status labels', () => {
    expect(statusLabel('DEMO')).toBe('Demonstration');
    expect(FEATURE_CATALOG.length).toBeGreaterThan(10);
  });
});
