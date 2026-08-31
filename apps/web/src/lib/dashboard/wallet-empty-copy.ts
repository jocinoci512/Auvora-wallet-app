/**
 * Dashboard empty-state selection for signed-in users.
 * Restored/unlocked vault must never push users into "Set up wallet".
 */

import { EMPTY_COPY } from './status-copy';

export function dashboardWalletEmptyCopy(args: {
  signedIn: boolean;
  walletReady: boolean;
}): (typeof EMPTY_COPY)[keyof typeof EMPTY_COPY] {
  if (!args.signedIn) return EMPTY_COPY.assets;
  if (args.walletReady) return EMPTY_COPY.walletReady;
  return EMPTY_COPY.wallet;
}
