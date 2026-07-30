import 'models.dart';

/// Plain-language permission catalog aligned with connections service wire codes
/// and web `permissions.ts` (same beginner-facing explanations).
PermissionInfo permissionInfoFor(DappPermissionCode code) {
  return switch (code) {
    DappPermissionCode.viewAddresses => const PermissionInfo(
        code: DappPermissionCode.viewAddresses,
        title: 'View your wallet address',
        explanation:
            'This app can see your wallet address on the networks you approve so it can recognize your account.',
        risk: ConnectionRisk.low,
        canMoveFunds: false,
      ),
    DappPermissionCode.viewBalances => const PermissionInfo(
        code: DappPermissionCode.viewBalances,
        title: 'View your balances',
        explanation:
            'This app can read token balances for accounts you connect. It cannot move funds with this permission alone.',
        risk: ConnectionRisk.low,
        canMoveFunds: false,
      ),
    DappPermissionCode.requestSignatures => const PermissionInfo(
        code: DappPermissionCode.requestSignatures,
        title: 'Ask you to sign messages',
        explanation:
            'This app can ask you to sign messages. Signing does not always move funds, but some signatures (like Permit or allowance approvals) can authorize spending later. You still approve each signature.',
        risk: ConnectionRisk.medium,
        canMoveFunds: false,
      ),
    DappPermissionCode.requestTransactions => const PermissionInfo(
        code: DappPermissionCode.requestTransactions,
        title: 'Ask you to approve transactions',
        explanation:
            'This app can ask you to send transactions. You still approve each one, and approved sends can move funds or assets.',
        risk: ConnectionRisk.elevated,
        canMoveFunds: true,
      ),
    DappPermissionCode.networkSwitch => const PermissionInfo(
        code: DappPermissionCode.networkSwitch,
        title: 'Suggest a network change',
        explanation:
            'This app may ask you to switch networks. You stay in control of whether the switch happens.',
        risk: ConnectionRisk.medium,
        canMoveFunds: false,
      ),
    DappPermissionCode.sessionManage => const PermissionInfo(
        code: DappPermissionCode.sessionManage,
        title: 'Keep a connected session',
        explanation:
            'This app wants to stay connected so you do not have to reconnect every visit. You can disconnect anytime.',
        risk: ConnectionRisk.low,
        canMoveFunds: false,
      ),
  };
}

String plainLanguagePermissions(Iterable<DappPermissionCode> codes) {
  return codes.map((code) => permissionInfoFor(code).title).join(' · ');
}

ConnectionRisk highestRisk(Iterable<DappPermissionCode> codes) {
  var risk = ConnectionRisk.low;
  for (final code in codes) {
    final next = permissionInfoFor(code).risk;
    if (next.index > risk.index) risk = next;
  }
  return risk;
}

bool permissionsCanMoveFunds(Iterable<DappPermissionCode> codes) {
  return codes.any((code) => permissionInfoFor(code).canMoveFunds);
}

/// One-line beginner summary of what approving allows today.
String permissionConsentSummary(Iterable<DappPermissionCode> codes) {
  final list = codes.toList();
  if (list.isEmpty) return 'This request does not ask for any permissions.';
  if (permissionsCanMoveFunds(list)) {
    return 'This app can see your address and ask you to move funds — you still approve each send.';
  }
  if (list.contains(DappPermissionCode.requestSignatures)) {
    return 'This app can see your address and ask you to sign messages. Some signatures can authorize spending later.';
  }
  return 'This app can see account details you approve. It cannot move funds with these permissions alone.';
}

String riskLabel(ConnectionRisk risk) => switch (risk) {
      ConnectionRisk.low => 'Low risk',
      ConnectionRisk.medium => 'Review carefully',
      ConnectionRisk.elevated => 'Elevated risk',
    };
