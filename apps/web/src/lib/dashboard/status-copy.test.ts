import { classifyHttpStatus, EMPTY_COPY, issueCopy } from './status-copy';

describe('dashboard status copy', () => {
  it('maps http statuses without exposing payloads', () => {
    expect(classifyHttpStatus(401)).toBe('session');
    expect(classifyHttpStatus(403)).toBe('permission');
    expect(classifyHttpStatus(429)).toBe('rate_limited');
    expect(classifyHttpStatus(503)).toBe('backend');
    expect(issueCopy('locked').title).toMatch(/locked/i);
    expect(issueCopy('market').body).not.toMatch(/\{|api/i);
  });

  it('guides empty states toward a real next action', () => {
    expect(EMPTY_COPY.assets.actionHref).toBe('/wallets/onboarding');
    expect(EMPTY_COPY.wallet.body).toMatch(/never custody/i);
  });
});
