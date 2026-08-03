/// Bootstrap WalletConnect provider: live Reown when Project ID is configured
/// and init succeeds; otherwise explicit preview fallback (never silent live).
///
/// Live Reown init is intentionally **deferred past first frame** so Android
/// cold start is not blocked by WalletKit / relay handshake (historically up
/// to ~30s on slow networks).
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
    this.liveInitDeferred = false,
  });

  final WalletConnectProviderPort provider;
  final bool liveInitAttempted;
  final bool liveInitSucceeded;
  final String? fallbackReason;

  /// True when Project ID is configured but live init was postponed.
  final bool liveInitDeferred;

  bool get usingLiveRelay => provider.isLiveRelay && liveInitSucceeded;
}

abstract final class WalletConnectBootstrap {
  /// Instant preview shell — never awaits Reown. Use for [runApp] then call
  /// [upgradeToLive] after the first frame.
  static WalletConnectBootstrapResult previewShell({String? projectId}) {
    final id = (projectId ?? IntegrationConfig.wcProjectId).trim();
    final configured = _isConfigured(id);
    if (!configured) {
      return WalletConnectBootstrapResult(
        provider: PreviewWalletConnectProvider(projectId: id),
        liveInitAttempted: false,
        liveInitSucceeded: false,
        fallbackReason: 'WC_PROJECT_ID not configured via --dart-define',
        liveInitDeferred: false,
      );
    }
    return WalletConnectBootstrapResult(
      provider: PreviewWalletConnectProvider(projectId: id),
      liveInitAttempted: false,
      liveInitSucceeded: false,
      fallbackReason: 'Live Reown init deferred until after first frame',
      liveInitDeferred: true,
    );
  }

  /// Blocking create (tests / explicit sync callers). Prefer [previewShell] +
  /// [upgradeToLive] on the Android critical path.
  static Future<WalletConnectBootstrapResult> create({
    String? projectId,
    Map<String, String> caipAccounts = const {},
  }) async {
    final shell = previewShell(projectId: projectId);
    if (!shell.liveInitDeferred && !shell.usingLiveRelay) {
      return shell;
    }
    return upgradeToLive(
      projectId: projectId,
      caipAccounts: caipAccounts,
    );
  }

  /// Live Reown WalletKit init with hard timeout. Never logs Project ID value.
  static Future<WalletConnectBootstrapResult> upgradeToLive({
    String? projectId,
    Map<String, String> caipAccounts = const {},
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final id = (projectId ?? IntegrationConfig.wcProjectId).trim();
    if (!_isConfigured(id)) {
      return WalletConnectBootstrapResult(
        provider: PreviewWalletConnectProvider(projectId: id),
        liveInitAttempted: false,
        liveInitSucceeded: false,
        fallbackReason: 'WC_PROJECT_ID not configured via --dart-define',
      );
    }

    try {
      final live = await ReownWalletConnectProvider.create(projectId: id)
          .timeout(timeout);
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

  static bool _isConfigured(String id) =>
      id.isNotEmpty &&
      id.toLowerCase() != 'your_project_id' &&
      !id.toLowerCase().contains('placeholder');
}
