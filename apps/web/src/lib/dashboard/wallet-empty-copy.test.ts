import { EMPTY_COPY } from './status-copy';
import { dashboardWalletEmptyCopy } from './wallet-empty-copy';

describe('dashboard wallet empty copy', () => {
  it('never shows Set up wallet when vault is ready on device', () => {
    const copy = dashboardWalletEmptyCopy({ signedIn: true, walletReady: true });
    expect(copy.title).toBe('Wallet ready');
    expect(copy.actionLabel).not.toMatch(/set up wallet/i);
    expect(JSON.stringify(copy)).not.toMatch(/NEXT_PUBLIC/i);
  });

  it('shows setup only when signed in without a device vault', () => {
    const copy = dashboardWalletEmptyCopy({ signedIn: true, walletReady: false });
    expect(copy).toBe(EMPTY_COPY.wallet);
  });

  it('shows assets empty when signed out', () => {
    expect(dashboardWalletEmptyCopy({ signedIn: false, walletReady: false })).toBe(
      EMPTY_COPY.assets,
    );
  });
});
