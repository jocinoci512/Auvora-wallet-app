import { DEMO_HOLDINGS } from '../dashboard-demo';

describe('live portfolio honesty', () => {
  it('demo holdings remain available as labeled fallback shape', () => {
    expect(DEMO_HOLDINGS.length).toBeGreaterThan(0);
    expect(DEMO_HOLDINGS[0]).toHaveProperty('walletLabel');
    expect(DEMO_HOLDINGS[0]).toHaveProperty('balance');
  });
});
