/// Bootstrap WalletConnect provider: live Reown when Project ID is configured
/// and init succeeds; otherwise explicit preview fallback (never silent live).
library;

import 'package:flutter/foundation.dart';

import '../release/integration_config.dart';
import 'reown_wallet_connect_provider.dart';
import 'wallet_connect_provider.dart';

class WalletConnectBootstrapResult {
  const WalletConnectBootstrapResult({
    required this.provider,
    required this.liveInitAttempted,
    required this.liveInitSucceeded,
    this.fallbackReason,
  });

  final WalletConnectProviderPort provider;
  final bool liveInitAttempted;
  final bool liveInitSucceeded;
  final String? fallbackReason;

  bool get usingLiveRelay => provider.isLiveRelay && liveInitSucceeded;
}

abstract final class WalletConnectBootstrap {
  static Future<WalletConnectBootstrapResult> create({
    String? projectId,
    Map<String, String> caipAccounts = const {},
  }) async {
    final id = (projectId ?? IntegrationConfig.wcProjectId).trim();
    final configured = id.isNotEmpty &&
        id.toLowerCase() != 'your_project_id' &&
        !id.toLowerCase().contains('placeholder');

    if (!configured) {
      return WalletConnectBootstrapResult(
        provider: PreviewWalletConnectProvider(projectId: id),
        liveInitAttempted: false,
        liveInitSucceeded: false,
        fallbackReason: 'WC_PROJECT_ID not configured via --dart-define',
      );
    }

    try {
      final live = await ReownWalletConnectProvider.create(projectId: id)
          .timeout(const Duration(seconds: 30));
      if (caipAccounts.isNotEmpty) {
        await live.registerAccounts(caipAccounts);
      }
      debugPrint(
        '[AuvoraWC] Reown WalletKit initialized (project configured=true, '
        'liveRelay=true). Project id value never logged.',
      );
      return WalletConnectBootstrapResult(
        provider: live,
        liveInitAttempted: true,
        liveInitSucceeded: true,
      );
    } catch (e) {
      debugPrint(
        '[AuvoraWC] Reown init failed — using PreviewWalletConnectProvider. '
        'errorType=${e.runtimeType}',
      );
      return WalletConnectBootstrapResult(
        provider: PreviewWalletConnectProvider(projectId: id),
        liveInitAttempted: true,
        liveInitSucceeded: false,
        fallbackReason: 'Reown WalletKit init failed (${e.runtimeType})',
      );
    }
  }
}
