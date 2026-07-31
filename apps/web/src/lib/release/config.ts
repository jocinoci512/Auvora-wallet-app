/** Version 1.0 Alpha / release gates — mirror mobile ReleaseConfig kill switches. */
export const ReleaseConfig = {
  releaseChannel: 'alpha',
  marketingVersion: '1.0.0-alpha.1',
  buildLabel: 'Version 1.0 Alpha',
  liveBroadcastEnabled: false,
  /** When false, companion Receive blocks QR / copy / share for funding. */
  allowFundingAddresses: false,
  fundingBlockedMessage:
    'Addresses on this companion are demo placeholders. Funding stays locked in Version 1.0 Alpha — QR, copy, and share are disabled. Do not send real funds.',
  websiteUrl: 'https://wallet.auvora.app',
  privacyPolicyUrl: 'https://wallet.auvora.app/legal/privacy',
  termsOfServiceUrl: 'https://wallet.auvora.app/legal/terms',
  supportEmail: 'alpha@auvora.app',
} as const;

export const isAlpha = ReleaseConfig.releaseChannel === 'alpha';

/** Live trading / broadcast only when both the service and Alpha kill switch allow it. */
export function canUseLiveBroadcast(serviceIndicatesLive = true): boolean {
  return Boolean(serviceIndicatesLive && ReleaseConfig.liveBroadcastEnabled);
}
