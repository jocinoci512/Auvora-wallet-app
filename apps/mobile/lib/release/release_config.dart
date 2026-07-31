/// Closed Beta / release gates. Flip only after security sign-off.
abstract final class ReleaseConfig {
  static const String releaseChannel = 'closed-beta';
  static const String marketingVersion = '1.1.0-beta.2';
  static const String buildLabel = 'RM2 Closed Beta';

  /// Live chain broadcast. Keep false until adapters are audited end-to-end.
  static const bool liveBroadcastEnabled = false;

  /// When false, Receive blocks copy/share/QR for funding addresses.
  /// Kept locked while Closed Beta validates HD addresses off-device.
  static const bool allowFundingAddresses = false;

  /// Address derivation quality for this build.
  /// BIP32/SLIP-0010 is active; funding stay gated until receive unlock sign-off.
  static const DerivationMode derivationMode = DerivationMode.bip32Partial;

  static const String fundingBlockedMessage =
      'Addresses now use BIP32 / SLIP-0010 HD paths, but Receive funding stays '
      'locked in Closed Beta until off-device verification completes. '
      'Do not send real funds yet.';

  static const String broadcastPreviewMessage =
      'Transfers stay on this device as a preview. Live broadcast is off '
      '(kill switch) until network signing is audited.';

  static bool get isClosedBeta => releaseChannel == 'closed-beta';

  static bool get usesHdDerivation =>
      derivationMode == DerivationMode.bip32Partial ||
      derivationMode == DerivationMode.production;
}

enum DerivationMode {
  previewSha,
  bip32Partial,
  production,
}
