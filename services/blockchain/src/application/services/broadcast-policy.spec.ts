import { ValidationError } from '../../domain';
import type { ServiceEnv } from '../../config/env.schema';
import { assertLiveBroadcastAllowed } from './broadcast-policy';

describe('assertLiveBroadcastAllowed', () => {
  const base = { BLOCKCHAIN_LIVE_BROADCAST: false } as ServiceEnv;

  it('throws when live broadcast is disabled (default)', () => {
    expect(() => assertLiveBroadcastAllowed(base)).toThrow(ValidationError);
    expect(() => assertLiveBroadcastAllowed(base)).toThrow(/BLOCKCHAIN_LIVE_BROADCAST=false/);
  });

  it('allows when explicitly enabled', () => {
    expect(() =>
      assertLiveBroadcastAllowed({ ...base, BLOCKCHAIN_LIVE_BROADCAST: true }),
    ).not.toThrow();
  });
});
