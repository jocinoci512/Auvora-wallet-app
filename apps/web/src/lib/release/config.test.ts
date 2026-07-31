import { canUseLiveBroadcast, ReleaseConfig } from './config';

describe('ReleaseConfig Alpha gates', () => {
  it('keeps live broadcast and funding locked', () => {
    expect(ReleaseConfig.liveBroadcastEnabled).toBe(false);
    expect(ReleaseConfig.allowFundingAddresses).toBe(false);
    expect(ReleaseConfig.marketingVersion).toBe('1.0.0-alpha.1');
  });

  it('canUseLiveBroadcast never enables when kill switch is off', () => {
    expect(canUseLiveBroadcast(true)).toBe(false);
    expect(canUseLiveBroadcast(false)).toBe(false);
  });
});
