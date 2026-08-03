import { APP_NAV_SECTIONS, isMarketingPath, isCurrentPath } from './app-nav';

describe('app-nav', () => {
  it('exposes HOME/MONEY/WALLETS/WEB3/INSIGHTS/SECURITY/ACCOUNT', () => {
    expect(APP_NAV_SECTIONS.map((s) => s.id)).toEqual([
      'home',
      'money',
      'wallets',
      'web3',
      'insights',
      'security',
      'account',
    ]);
  });

  it('treats auth and legal as marketing shell paths', () => {
    expect(isMarketingPath('/')).toBe(true);
    expect(isMarketingPath('/auth/login')).toBe(true);
    expect(isMarketingPath('/legal/privacy')).toBe(true);
    expect(isMarketingPath('/dashboard')).toBe(false);
  });

  it('matches nested paths', () => {
    expect(isCurrentPath('/settings/security', '/settings')).toBe(true);
    expect(isCurrentPath('/dashboard', '/portfolio')).toBe(false);
  });

  it('does not expose NFT routes in IA', () => {
    const hrefs = APP_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs.some((h) => h.includes('nft'))).toBe(false);
  });
});
