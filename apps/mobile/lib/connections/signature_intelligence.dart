import 'models.dart';

/// Calm plain-language guidance for signature and transaction reviews.
/// Never financial advice — educational only.
class SignatureIntelligence {
  const SignatureIntelligence({
    required this.headline,
    required this.bullets,
    required this.fundsMove,
  });

  final String headline;
  final List<String> bullets;
  final bool fundsMove;

  static SignatureIntelligence forSignature(SignatureRequest request) {
    if (request.canMoveFunds || request.kind == SignatureKind.typedData) {
    return const SignatureIntelligence(
      headline: 'This request may allow spending later',
      bullets: [
        'Typed data and Permit-style signatures can approve token spending without an immediate transfer.',
        'No cryptocurrency moves until a separate transaction is approved — but this can authorize future spends.',
        'Reject if you did not expect an allowance or spending approval.',
        'You can disconnect the app anytime in Permission Center.',
      ],
      fundsMove: true,
    );
    }
    return const SignatureIntelligence(
      headline: 'This request proves ownership of your wallet',
      bullets: [
        'No funds will move if you approve this message alone.',
        'The app can show that you control this address.',
        'Only approve requests you fully understand.',
      ],
      fundsMove: false,
    );
  }

  static SignatureIntelligence forTransaction(DappTransactionRequest request) {
    return SignatureIntelligence(
      headline: 'This transaction will spend cryptocurrency',
      bullets: [
        'Approving sends ${request.amount} ${request.assetSymbol} on ${request.network}.',
        'Estimated fee: ${request.feeEstimate}.',
        'Only approve transactions you fully understand.',
        'You can disconnect this application at any time.',
      ],
      fundsMove: true,
    );
  }

  static List<String> connectionTips(DappConnectionRequest request) {
    return [
      'Review the app name, website, and permissions before approving.',
      if (request.permissions.contains(DappPermissionCode.requestTransactions))
        'This permission allows the app to request transactions that move funds — you still confirm each one.',
      if (request.permissions.contains(DappPermissionCode.requestSignatures))
        'Signature requests can prove ownership or, for typed data, authorize spending.',
      'You can disconnect this application at any time from Permission Center.',
      'Never share your recovery phrase with any dApp.',
    ];
  }
}
