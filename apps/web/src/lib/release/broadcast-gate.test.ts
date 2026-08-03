import { ReleaseConfig, canUseLiveBroadcast } from './config';

describe('broadcast gate', () => {
  it('keeps live broadcast off', () => {
    expect(ReleaseConfig.liveBroadcastEnabled).toBe(false);
    expect(ReleaseConfig.allowFundingAddresses).toBe(false);
    expect(canUseLiveBroadcast(true)).toBe(false);
  });
});
