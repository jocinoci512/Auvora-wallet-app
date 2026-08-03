/// WalletConnect-shaped provider port.
///
/// Closed Beta ships [PreviewWalletConnectProvider] (local pairing / no live relay).
/// A future Reown/WC SDK adapter can implement this port without changing
/// Permission Center, approval sheets, or signing UI.
library;

import '../release/integration_config.dart';
import 'models.dart';

class WalletConnectProposal {
  const WalletConnectProposal({
    required this.proposalId,
    required this.topic,
    required this.uri,
    required this.qrPayload,
    required this.deepLink,
    required this.requestedNetworks,
    required this.permissions,
    required this.expiresAt,
    this.peerName,
    this.peerUrl,
    this.protocolVersion = '2',
  });

  final String proposalId;
  final String topic;
  final String uri;
  final String qrPayload;
  final String deepLink;
  final List<String> requestedNetworks;
  final List<DappPermissionCode> permissions;
  final DateTime expiresAt;
  final String? peerName;
  final String? peerUrl;
  final String protocolVersion;

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

class WalletConnectSessionSnapshot {
  const WalletConnectSessionSnapshot({
    required this.sessionId,
    required this.topic,
    required this.status,
    required this.peerName,
    required this.networks,
    required this.permissions,
    required this.accounts,
    required this.createdAt,
    required this.expiresAt,
    this.peerUrl,
    this.protocolVersion = '2',
  });

  final String sessionId;
  final String topic;
  final WalletConnectSessionStatus status;
  final String peerName;
  final String? peerUrl;
  final List<String> networks;
  final List<DappPermissionCode> permissions;
  final List<String> accounts;
  final DateTime createdAt;
  final DateTime expiresAt;
  final String protocolVersion;

  bool get isExpired =>
      status == WalletConnectSessionStatus.expired || DateTime.now().isAfter(expiresAt);
}

enum WalletConnectSessionStatus {
  pending,
  active,
  rejected,
  expired,
  terminated,
}

/// Live session proposal emitted by [ReownWalletConnectProvider].
class LiveSessionProposalEvent {
  const LiveSessionProposalEvent({
    required this.proposalId,
    required this.proposerName,
    required this.proposerUrl,
    required this.proposerIcon,
    required this.requiredChains,
    required this.optionalChains,
    required this.methods,
    required this.events,
    required this.expiresAt,
    this.verifyRisk,
    this.generatedNamespacesReady = false,
  });

  final int proposalId;
  final String proposerName;
  final String proposerUrl;
  final String? proposerIcon;
  final List<String> requiredChains;
  final List<String> optionalChains;
  final List<String> methods;
  final List<String> events;
  final DateTime expiresAt;
  final String? verifyRisk;
  final bool generatedNamespacesReady;
}

/// Live session request (sign / tx) emitted by the Reown adapter.
class LiveSessionRequestEvent {
  const LiveSessionRequestEvent({
    required this.requestId,
    required this.topic,
    required this.method,
    required this.chainId,
    required this.params,
  });

  final int requestId;
  final String topic;
  final String method;
  final String chainId;
  final dynamic params;
}

/// Protocol-upgrade seam for WalletConnect / Reown clients.
abstract class WalletConnectProviderPort {
  String get code;
  String get name;
  String get protocolVersion;

  /// True when this provider talks to a live relay (never claim this for preview).
  bool get isLiveRelay;

  /// True after successful Reown WalletKit init against a real project id.
  bool get isInitialized;

  /// Reown / WalletConnect Cloud project id when compiled in (may be empty).
  /// Never log the raw value.
  String get projectId;

  /// Project id present and non-placeholder.
  bool get hasConfiguredProjectId;

  Future<WalletConnectProposal> createProposal({
    required List<String> networks,
    required List<DappPermissionCode> permissions,
    String? peerHint,
  });

  Future<WalletConnectSessionSnapshot> approveSession({
    required String proposalId,
    required List<String> accounts,
  });

  Future<WalletConnectSessionSnapshot> rejectSession(String proposalId);

  Future<WalletConnectSessionSnapshot?> restoreSession(String sessionId);

  Future<void> terminateSession(String sessionId);

  /// Validate an inbound deep link / wc: URI before creating a pairing request.
  DeepLinkValidation validateInboundUri(String raw);

  /// Live pair against a `wc:` URI. Preview providers throw / no-op.
  Future<void> pairUri(String wcUri);

  /// Approve a live Reown session proposal by numeric id.
  Future<WalletConnectSessionSnapshot> approveLiveProposal({
    required int proposalId,
    required List<String> accounts,
  });

  /// Reject a live Reown session proposal.
  Future<void> rejectLiveProposal(int proposalId);

  /// Respond to a live session request after local sign / user decision.
  Future<void> respondLiveRequest({
    required String topic,
    required int requestId,
    String? result,
    String? errorMessage,
    int errorCode = 5001,
  });

  /// Optional stream of live session proposals (empty for preview).
  Stream<LiveSessionProposalEvent> get sessionProposals;

  /// Optional stream of live session requests (empty for preview).
  Stream<LiveSessionRequestEvent> get sessionRequests;

  /// Optional stream when a remote dApp deletes a session.
  Stream<String> get sessionDeletes;

  /// Register EVM accounts for namespace building. No-op for preview.
  Future<void> registerAccounts(Map<String, String> caipToAddress);

  /// Dispose / detach listeners. No-op for preview.
  Future<void> dispose();
}

enum DeepLinkKind {
  walletConnectUri,
  auvoraWc,
  /// Web companion handshake (`auvora://pair`) — opens Connect UI; no WC URI yet.
  companionPair,
  transactionRequest,
  authentication,
  unsupported,
  invalid,
}

class DeepLinkValidation {
  const DeepLinkValidation({
    required this.kind,
    required this.valid,
    this.extractedUri,
    this.message,
  });

  final DeepLinkKind kind;
  final bool valid;
  final String? extractedUri;
  final String? message;
}

/// Local preview provider — WalletConnect-shaped payloads without a live relay.
///
/// Compile `--dart-define=WC_PROJECT_ID=...` from https://cloud.reown.com so
/// Closed Beta builds carry the project id; live relay still requires the Reown SDK.
class PreviewWalletConnectProvider implements WalletConnectProviderPort {
  PreviewWalletConnectProvider({
    Duration proposalTtl = const Duration(minutes: 5),
    Duration sessionTtl = const Duration(days: 7),
    String? projectId,
  })  : _proposalTtl = proposalTtl,
        _sessionTtl = sessionTtl,
        _projectId = projectId ?? IntegrationConfig.wcProjectId;

  final Duration _proposalTtl;
  final Duration _sessionTtl;
  final String _projectId;
  final Map<String, WalletConnectProposal> _proposals = {};
  final Map<String, WalletConnectSessionSnapshot> _sessions = {};

  @override
  String get code => 'walletconnect_preview';

  @override
  String get name => _projectId.isEmpty
      ? 'WalletConnect (preview)'
      : 'WalletConnect (project configured · preview fallback)';

  @override
  String get protocolVersion => '2';

  @override
  bool get isLiveRelay => false;

  @override
  bool get isInitialized => false;

  @override
  String get projectId => _projectId;

  @override
  bool get hasConfiguredProjectId =>
      _projectId.trim().isNotEmpty &&
      _projectId.trim().toLowerCase() != 'your_project_id' &&
      !_projectId.trim().toLowerCase().contains('placeholder');

  @override
  Stream<LiveSessionProposalEvent> get sessionProposals =>
      const Stream<LiveSessionProposalEvent>.empty();

  @override
  Stream<LiveSessionRequestEvent> get sessionRequests =>
      const Stream<LiveSessionRequestEvent>.empty();

  @override
  Stream<String> get sessionDeletes => const Stream<String>.empty();

  @override
  Future<void> pairUri(String wcUri) async {
    throw UnsupportedError('Preview provider does not pair with a live relay.');
  }

  @override
  Future<WalletConnectSessionSnapshot> approveLiveProposal({
    required int proposalId,
    required List<String> accounts,
  }) async {
    throw UnsupportedError('Preview provider has no live proposals.');
  }

  @override
  Future<void> rejectLiveProposal(int proposalId) async {}

  @override
  Future<void> respondLiveRequest({
    required String topic,
    required int requestId,
    String? result,
    String? errorMessage,
    int errorCode = 5001,
  }) async {}

  @override
  Future<void> registerAccounts(Map<String, String> caipToAddress) async {}

  @override
  Future<void> dispose() async {}

  @override
  DeepLinkValidation validateInboundUri(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return const DeepLinkValidation(
        kind: DeepLinkKind.invalid,
        valid: false,
        message: 'Empty link.',
      );
    }

    final lower = trimmed.toLowerCase();

    if (lower.startsWith('wc:')) {
      if (!_looksLikeWcUri(trimmed)) {
        return const DeepLinkValidation(
          kind: DeepLinkKind.invalid,
          valid: false,
          message: 'This WalletConnect URI looks incomplete or invalid.',
        );
      }
      return DeepLinkValidation(
        kind: DeepLinkKind.walletConnectUri,
        valid: true,
        extractedUri: trimmed,
        message: 'WalletConnect pairing URI ready to review.',
      );
    }

    Uri? uri;
    try {
      uri = Uri.parse(trimmed);
    } catch (_) {
      return const DeepLinkValidation(
        kind: DeepLinkKind.invalid,
        valid: false,
        message: 'Could not parse this link.',
      );
    }

    if (uri.scheme == 'auvora') {
      if (uri.host == 'wc' || uri.pathSegments.contains('wc')) {
        final nested = uri.queryParameters['uri'] ?? uri.queryParameters['wc'];
        if (nested == null || nested.isEmpty) {
          return const DeepLinkValidation(
            kind: DeepLinkKind.invalid,
            valid: false,
            message: 'Auvora WalletConnect link is missing a pairing URI.',
          );
        }
        final decoded = Uri.decodeComponent(nested);
        if (!_looksLikeWcUri(decoded) && !decoded.startsWith('http')) {
          return const DeepLinkValidation(
            kind: DeepLinkKind.invalid,
            valid: false,
            message: 'Embedded pairing payload is not a valid WalletConnect URI.',
          );
        }
        return DeepLinkValidation(
          kind: DeepLinkKind.auvoraWc,
          valid: true,
          extractedUri: decoded,
          message: 'App-to-app WalletConnect link ready to review.',
        );
      }
      if (uri.host == 'sign' || uri.host == 'tx' || uri.path.contains('sign')) {
        return DeepLinkValidation(
          kind: DeepLinkKind.transactionRequest,
          valid: true,
          extractedUri: trimmed,
          message: 'Transaction or signature deep link — open Signing to review (never auto-approve).',
        );
      }
      if (uri.host == 'auth' || uri.path.contains('auth')) {
        return DeepLinkValidation(
          kind: DeepLinkKind.authentication,
          valid: true,
          extractedUri: trimmed,
          message: 'Authentication deep link — confirm only after reviewing the app name and domain.',
        );
      }
      if (uri.host == 'pair' || uri.pathSegments.contains('pair')) {
        return const DeepLinkValidation(
          kind: DeepLinkKind.companionPair,
          valid: true,
          extractedUri: null,
          message:
              'Web companion pair link received. Open Connect dApp and paste or scan a WalletConnect URI from the same Reown project — keys stay on device.',
        );
      }
      return DeepLinkValidation(
        kind: DeepLinkKind.unsupported,
        valid: false,
        message: 'This Auvora link type is not supported yet (${uri.host}).',
      );
    }

    if (uri.scheme == 'https' || uri.scheme == 'http') {
      return DeepLinkValidation(
        kind: DeepLinkKind.auvoraWc,
        valid: true,
        extractedUri: trimmed,
        message: 'Website origin link — review carefully before connecting.',
      );
    }

    return DeepLinkValidation(
      kind: DeepLinkKind.unsupported,
      valid: false,
      message: 'Unsupported link scheme “${uri.scheme}”.',
    );
  }

  @override
  Future<WalletConnectProposal> createProposal({
    required List<String> networks,
    required List<DappPermissionCode> permissions,
    String? peerHint,
  }) async {
    final id = 'prop_${DateTime.now().microsecondsSinceEpoch}';
    final topic = 'topic_${id.hashCode.toRadixString(16)}';
    final uri =
        'wc:$topic@2?relay-protocol=irn&symKey=preview${id.hashCode.toRadixString(16)}'
        '${peerHint != null && peerHint.startsWith('http') ? '#$peerHint' : ''}';
    final proposal = WalletConnectProposal(
      proposalId: id,
      topic: topic,
      uri: uri,
      qrPayload: uri,
      deepLink: 'auvora://wc?uri=${Uri.encodeComponent(uri)}',
      requestedNetworks: networks.isEmpty ? const ['ETHEREUM'] : networks,
      permissions: permissions.isEmpty
          ? const [
              DappPermissionCode.viewAddresses,
              DappPermissionCode.requestSignatures,
            ]
          : permissions,
      expiresAt: DateTime.now().add(_proposalTtl),
      peerName: peerHint,
      peerUrl: peerHint?.startsWith('http') == true ? peerHint : null,
      protocolVersion: protocolVersion,
    );
    _proposals[id] = proposal;
    return proposal;
  }

  @override
  Future<WalletConnectSessionSnapshot> approveSession({
    required String proposalId,
    required List<String> accounts,
  }) async {
    final proposal = _proposals[proposalId];
    if (proposal == null) {
      throw StateError('Unknown WalletConnect proposal');
    }
    if (proposal.isExpired) {
      return WalletConnectSessionSnapshot(
        sessionId: proposalId,
        topic: proposal.topic,
        status: WalletConnectSessionStatus.expired,
        peerName: proposal.peerName ?? 'Unknown app',
        peerUrl: proposal.peerUrl,
        networks: proposal.requestedNetworks,
        permissions: proposal.permissions,
        accounts: accounts,
        createdAt: DateTime.now(),
        expiresAt: proposal.expiresAt,
        protocolVersion: proposal.protocolVersion,
      );
    }
    final session = WalletConnectSessionSnapshot(
      sessionId: 'wc_$proposalId',
      topic: proposal.topic,
      status: WalletConnectSessionStatus.active,
      peerName: proposal.peerName ?? 'Connected app',
      peerUrl: proposal.peerUrl,
      networks: proposal.requestedNetworks,
      permissions: proposal.permissions,
      accounts: accounts.isEmpty ? const ['Primary account'] : accounts,
      createdAt: DateTime.now(),
      expiresAt: DateTime.now().add(_sessionTtl),
      protocolVersion: proposal.protocolVersion,
    );
    _sessions[session.sessionId] = session;
    _proposals.remove(proposalId);
    return session;
  }

  @override
  Future<WalletConnectSessionSnapshot> rejectSession(String proposalId) async {
    final proposal = _proposals.remove(proposalId);
    return WalletConnectSessionSnapshot(
      sessionId: proposalId,
      topic: proposal?.topic ?? 'unknown',
      status: WalletConnectSessionStatus.rejected,
      peerName: proposal?.peerName ?? 'Unknown app',
      peerUrl: proposal?.peerUrl,
      networks: proposal?.requestedNetworks ?? const [],
      permissions: proposal?.permissions ?? const [],
      accounts: const [],
      createdAt: DateTime.now(),
      expiresAt: DateTime.now(),
      protocolVersion: proposal?.protocolVersion ?? protocolVersion,
    );
  }

  @override
  Future<WalletConnectSessionSnapshot?> restoreSession(String sessionId) async {
    final existing = _sessions[sessionId];
    if (existing == null) return null;
    if (existing.isExpired) {
      final expired = WalletConnectSessionSnapshot(
        sessionId: existing.sessionId,
        topic: existing.topic,
        status: WalletConnectSessionStatus.expired,
        peerName: existing.peerName,
        peerUrl: existing.peerUrl,
        networks: existing.networks,
        permissions: existing.permissions,
        accounts: existing.accounts,
        createdAt: existing.createdAt,
        expiresAt: existing.expiresAt,
        protocolVersion: existing.protocolVersion,
      );
      _sessions[sessionId] = expired;
      return expired;
    }
    final restored = WalletConnectSessionSnapshot(
      sessionId: existing.sessionId,
      topic: existing.topic,
      status: WalletConnectSessionStatus.active,
      peerName: existing.peerName,
      peerUrl: existing.peerUrl,
      networks: existing.networks,
      permissions: existing.permissions,
      accounts: existing.accounts,
      createdAt: existing.createdAt,
      expiresAt: existing.expiresAt,
      protocolVersion: existing.protocolVersion,
    );
    _sessions[sessionId] = restored;
    return restored;
  }

  @override
  Future<void> terminateSession(String sessionId) async {
    final existing = _sessions[sessionId];
    if (existing == null) return;
    _sessions[sessionId] = WalletConnectSessionSnapshot(
      sessionId: existing.sessionId,
      topic: existing.topic,
      status: WalletConnectSessionStatus.terminated,
      peerName: existing.peerName,
      peerUrl: existing.peerUrl,
      networks: existing.networks,
      permissions: existing.permissions,
      accounts: existing.accounts,
      createdAt: existing.createdAt,
      expiresAt: existing.expiresAt,
      protocolVersion: existing.protocolVersion,
    );
  }

  bool _looksLikeWcUri(String raw) {
    if (!raw.toLowerCase().startsWith('wc:')) return false;
    final body = raw.substring(3);
    if (body.isEmpty) return false;
    // Minimal shape: topic@version or topic@2?...
    return body.contains('@') || body.length >= 8;
  }
}
