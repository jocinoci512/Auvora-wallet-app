import { APP_NAV_SECTIONS, isMarketingPath, isCurrentPath, pageTitleForPath } from './app-nav';

describe('app-nav', () => {
  it('exposes primary wallet destinations and account secondary', () => {
    expect(APP_NAV_SECTIONS.map((s) => s.id)).toEqual(['primary', 'account']);
    const labels = APP_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.label));
    expect(labels).toEqual([
      'Overview',
      'Assets',
      'Activity',
      'Connections',
      'Account',
      'Settings',
      'Security',
    ]);
  });

  it('treats auth and legal as marketing shell paths', () => {
    expect(isMarketingPath('/')).toBe(true);
    expect(isMarketingPath('/auth/login')).toBe(true);
    expect(isMarketingPath('/legal/privacy')).toBe(true);
    expect(isMarketingPath('/dashboard')).toBe(false);
  });

  it('does not mark Settings current on Security or Account', () => {
    expect(isCurrentPath('/settings', '/settings')).toBe(true);
    expect(isCurrentPath('/settings/security', '/settings')).toBe(false);
    expect(isCurrentPath('/settings/security', '/settings/security')).toBe(true);
    expect(isCurrentPath('/settings/account', '/settings/account')).toBe(true);
    expect(isCurrentPath('/dashboard', '/portfolio')).toBe(false);
  });

  it('does not expose NFT routes in IA', () => {
    const hrefs = APP_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs.some((h) => h.includes('nft'))).toBe(false);
  });

  it('resolves page titles for shell header', () => {
    expect(pageTitleForPath('/assets/h-eth')).toBe('Asset');
    expect(pageTitleForPath('/settings/security')).toBe('Security');
  });
});
