/// Closed Beta / release gates. Flip only after security sign-off.
abstract final class ReleaseConfig {
  static const String releaseChannel = 'closed-beta';
  static const String marketingVersion = '1.1.0-beta.1';
  static const String buildLabel = 'RM2 Closed Beta';

  /// Live chain broadcast. Keep false until BIP32 + audited adapters ship.
  static const bool liveBroadcastEnabled = false;

  /// When false, Receive blocks copy/share/QR for funding (preview derivation).
  static const bool allowFundingAddresses = false;

  /// Address derivation quality for this build.
  static const DerivationMode derivationMode = DerivationMode.previewSha;

  static const String fundingBlockedMessage =
      'Closed Beta uses preview addresses that are not BIP32-compatible. '
      'Do not send real funds. Live receive unlocks after HD derivation ships.';

  static const String broadcastPreviewMessage =
      'Transfers stay on this device as a preview. Live broadcast is off '
      '(kill switch) until network signing is audited.';

  static bool get isClosedBeta => releaseChannel == 'closed-beta';
}

enum DerivationMode {
  previewSha,
  bip32Partial,
  production,
}
