/// Live Reown WalletKit adapter implementing [WalletConnectProviderPort].
///
/// Wallet-side only: inbound pairing → session proposal → user approval →
/// session requests → local sign. Never places a Reown Secret in the APK.
/// Falls back is handled by [WalletConnectBootstrap] — this class never
/// silently pretends to be live when init fails.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:reown_walletkit/reown_walletkit.dart';

import '../release/integration_config.dart';
import 'models.dart';
import 'wc_chain_catalog.dart';
import 'wallet_connect_provider.dart';

class ReownWalletConnectProvider implements WalletConnectProviderPort {
  ReownWalletConnectProvider._({
    required ReownWalletKit walletKit,
    required String projectId,
  })  : _walletKit = walletKit,
        _projectId = projectId;

  final ReownWalletKit _walletKit;
  final String _projectId;
  final _proposalController = StreamController<LiveSessionProposalEvent>.broadcast();
  final _requestController = StreamController<LiveSessionRequestEvent>.broadcast();
  final _deleteController = StreamController<String>.broadcast();
  final Map<int, SessionProposalEvent> _pendingProposals = {};
  final Map<String, WalletConnectSessionSnapshot> _sessions = {};
  final Map<int, Completer<_LiveRequestDecision>> _requestCompleters = {};
  bool _disposed = false;
  bool _handlersRegistered = false;

  /// Create + init WalletKit. Throws on invalid/empty project id or init failure.
  static Future<ReownWalletConnectProvider> create({
    String? projectId,
    String metadataUrl = 'https://wallet.auvora.app',
    String metadataName = 'Auvora Wallet',
    String metadataDescription = 'Self-custody multi-chain wallet',
    List<String> icons = const [
      'https://wallet.auvora.app/icon.png',
    ],
  }) async {
    final id = (projectId ?? IntegrationConfig.wcProjectId).trim();
    if (id.isEmpty ||
        id.toLowerCase() == 'your_project_id' ||
        id.toLowerCase().contains('placeholder')) {
      throw StateError(
        'WC_PROJECT_ID missing or placeholder — refusing silent Reown init.',
      );
    }

    final walletKit = await ReownWalletKit.createInstance(
      projectId: id,
      metadata: PairingMetadata(
        name: metadataName,
        description: metadataDescription,
        url: metadataUrl,
        icons: icons,
        redirect: const Redirect(
          native: 'auvora://wc',
          universal: 'https://wallet.auvora.app/wc',
          linkMode: false,
        ),
      ),
      logLevel: kDebugMode ? LogLevel.error : LogLevel.nothing,
    );

    final provider = ReownWalletConnectProvider._(
      walletKit: walletKit,
      projectId: id,
    );
    provider._attachListeners();
    return provider;
  }

  void _attachListeners() {
    _walletKit.onSessionProposal.subscribe(_onSessionProposal);
    _walletKit.onSessionProposalError.subscribe(_onSessionProposalError);
    _walletKit.onSessionDelete.subscribe(_onSessionDelete);
    _walletKit.onSessionRequest.subscribe(_onSessionRequest);
  }

  void _onSessionProposal(SessionProposalEvent? event) {
    if (event == null || _disposed) return;
    _pendingProposals[event.id] = event;
    final proposer = event.params.proposer.metadata;
    final required = <String>{};
    final optional = <String>{};
    final methods = <String>{};
    final events = <String>{};
    event.params.requiredNamespaces.forEach((_, ns) {
      required.addAll(ns.chains ?? const []);
      methods.addAll(ns.methods);
      events.addAll(ns.events);
    });
    event.params.optionalNamespaces.forEach((_, ns) {
      optional.addAll(ns.chains ?? const []);
      methods.addAll(ns.methods);
      events.addAll(ns.events);
    });
    _proposalController.add(
      LiveSessionProposalEvent(
        proposalId: event.id,
        proposerName: proposer.name.isEmpty ? 'Unknown dApp' : proposer.name,
        proposerUrl: proposer.url,
        proposerIcon: proposer.icons.isNotEmpty ? proposer.icons.first : null,
        requiredChains: required.toList(growable: false),
        optionalChains: optional.toList(growable: false),
        methods: methods.toList(growable: false),
        events: events.toList(growable: false),
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
        verifyRisk: event.verifyContext?.validation.toString(),
        generatedNamespacesReady: event.params.generatedNamespaces != null,
      ),
    );
  }

  void _onSessionProposalError(SessionProposalErrorEvent? event) {
    if (event == null) return;
    debugPrint(
      '[AuvoraWC] session proposal error code=${event.error.code} '
      '(message redacted length=${event.error.message.length})',
    );
  }

  void _onSessionDelete(SessionDelete? event) {
    if (event == null || _disposed) return;
    _sessions.remove(event.topic);
    _deleteController.add(event.topic);
  }

  void _onSessionRequest(SessionRequestEvent? event) {
    if (event == null || _disposed) return;
    // When request handlers are registered, this may not fire; handlers cover that path.
    _emitSessionRequest(
      requestId: event.id,
      topic: event.topic,
      method: event.method,
      chainId: event.chainId,
      params: event.params,
    );
  }

  void _emitSessionRequest({
    required int requestId,
    required String topic,
    required String method,
    required String chainId,
    required dynamic params,
  }) {
    _requestController.add(
      LiveSessionRequestEvent(
        requestId: requestId,
        topic: topic,
        method: method,
        chainId: chainId,
        params: params,
      ),
    );
  }

  Future<void> _methodHandler(String topic, dynamic params) async {
    SessionRequest? pending;
    try {
      final all = _walletKit.pendingRequests.getAll();
      if (all.isNotEmpty) pending = all.last;
    } catch (_) {}
    if (pending == null) return;

    final completer = Completer<_LiveRequestDecision>();
    _requestCompleters[pending.id] = completer;
    _emitSessionRequest(
      requestId: pending.id,
      topic: topic,
      method: pending.method,
      chainId: pending.chainId,
      params: params,
    );

    _LiveRequestDecision decision;
    try {
      decision = await completer.future.timeout(const Duration(minutes: 5));
    } on TimeoutException {
      decision = const _LiveRequestDecision(
        errorCode: 5001,
        errorMessage: 'Request timed out waiting for user approval',
      );
    } finally {
      _requestCompleters.remove(pending.id);
    }

    if (decision.result != null) {
      await respondLiveRequest(
        topic: topic,
        requestId: pending.id,
        result: decision.result,
      );
    } else {
      await respondLiveRequest(
        topic: topic,
        requestId: pending.id,
        errorCode: decision.errorCode,
        errorMessage: decision.errorMessage,
      );
    }
  }

  /// Complete a pending live request after UI approval / rejection / sign.
  void completeLiveRequest(
    int requestId, {
    String? result,
    String? errorMessage,
    int errorCode = 5001,
  }) {
    final c = _requestCompleters[requestId];
    if (c == null || c.isCompleted) return;
    c.complete(
      _LiveRequestDecision(
        result: result,
        errorCode: errorCode,
        errorMessage: errorMessage,
      ),
    );
  }

  @override
  String get code => 'reown_walletkit';

  @override
  String get name => 'Reown WalletKit (live)';

  @override
  String get protocolVersion => '2';

  @override
  bool get isLiveRelay => true;

  @override
  bool get isInitialized => !_disposed;

  @override
  String get projectId => _projectId;

  @override
  bool get hasConfiguredProjectId =>
      _projectId.trim().isNotEmpty &&
      _projectId.trim().toLowerCase() != 'your_project_id' &&
      !_projectId.trim().toLowerCase().contains('placeholder');

  @override
  Stream<LiveSessionProposalEvent> get sessionProposals => _proposalController.stream;

  @override
  Stream<LiveSessionRequestEvent> get sessionRequests => _requestController.stream;

  @override
  Stream<String> get sessionDeletes => _deleteController.stream;

  @override
  Future<void> registerAccounts(Map<String, String> caipToAddress) async {
    for (final entry in caipToAddress.entries) {
      final chainId = entry.key;
      final address = entry.value;
      if (!WcChainCatalog.isSupportedCaip(chainId)) continue;
      if (address.isEmpty) continue;
      _walletKit.registerAccount(chainId: chainId, accountAddress: address);
      // Register supported methods so namespace builder can include them.
      // Handlers enqueue via onSessionRequest (we do not auto-sign here).
      for (final method in WcChainCatalog.supportedEvmMethods) {
        _walletKit.registerRequestHandler(
          chainId: chainId,
          method: method,
          handler: _methodHandler,
        );
      }
      for (final event in WcChainCatalog.supportedEvents) {
        _walletKit.registerEventEmitter(chainId: chainId, event: event);
      }
    }
    // Explicitly do NOT register eth_sign.
    _handlersRegistered = true;
  }

  @override
  DeepLinkValidation validateInboundUri(String raw) {
    // Reuse the same validation rules as preview.
    return PreviewWalletConnectProvider(projectId: _projectId).validateInboundUri(raw);
  }

  @override
  Future<void> pairUri(String wcUri) async {
    final validation = validateInboundUri(wcUri);
    if (!validation.valid || validation.extractedUri == null) {
      throw ArgumentError(validation.message ?? 'Invalid WalletConnect URI');
    }
    final uri = Uri.tryParse(validation.extractedUri!);
    if (uri == null || uri.scheme != 'wc') {
      throw ArgumentError('Pairing requires a wc: URI');
    }
    try {
      await _walletKit.pair(uri: uri).timeout(const Duration(seconds: 25));
    } on TimeoutException {
      throw StateError('WalletConnect pairing timed out. Check network and try again.');
    } catch (e) {
      throw StateError(
        'WalletConnect pairing failed. The URI may be expired or the relay is unavailable.',
      );
    }
  }

  @override
  Future<WalletConnectProposal> createProposal({
    required List<String> networks,
    required List<DappPermissionCode> permissions,
    String? peerHint,
  }) async {
    // Live wallets receive proposals from dApps after pair(); this factory
    // shape is retained for port compatibility (e.g. desktop pairing codes).
    return PreviewWalletConnectProvider(projectId: _projectId).createProposal(
      networks: networks,
      permissions: permissions,
      peerHint: peerHint,
    );
  }

  @override
  Future<WalletConnectSessionSnapshot> approveSession({
    required String proposalId,
    required List<String> accounts,
  }) async {
    final asInt = int.tryParse(proposalId);
    if (asInt != null && _pendingProposals.containsKey(asInt)) {
      return approveLiveProposal(proposalId: asInt, accounts: accounts);
    }
    return PreviewWalletConnectProvider(projectId: _projectId).approveSession(
      proposalId: proposalId,
      accounts: accounts,
    );
  }

  @override
  Future<WalletConnectSessionSnapshot> approveLiveProposal({
    required int proposalId,
    required List<String> accounts,
  }) async {
    final event = _pendingProposals[proposalId];
    if (event == null) {
      throw StateError('Unknown or expired session proposal');
    }
    // Prefer SDK-generated namespaces when accounts/methods were registered;
    // otherwise build a strict EVM-only namespace. Never grant BTC/TRON/Solana.
    final generated = event.params.generatedNamespaces;
    final filtered = <String, Namespace>{};

    if (generated != null && generated.isNotEmpty) {
      generated.forEach((key, ns) {
        if (key != 'eip155') return;
        final chains = (ns.chains ?? const <String>[])
            .where(WcChainCatalog.isSupportedCaip)
            .toList();
        if (chains.isEmpty) return;
        final methods = ns.methods
            .where(WcChainCatalog.isSupportedMethod)
            .toList();
        if (methods.isEmpty) return;
        filtered[key] = Namespace(
          accounts: [
            for (final chain in chains)
              for (final account in accounts)
                if (account.isNotEmpty) '$chain:$account',
          ],
          methods: methods,
          events: ns.events
              .where((e) => WcChainCatalog.supportedEvents.contains(e))
              .toList(),
          chains: chains,
        );
      });
    }

    if (filtered.isEmpty) {
      final requested = <String>{};
      event.params.requiredNamespaces.forEach((_, ns) {
        requested.addAll(ns.chains ?? const []);
      });
      event.params.optionalNamespaces.forEach((_, ns) {
        requested.addAll(ns.chains ?? const []);
      });
      final chains = requested.where(WcChainCatalog.isSupportedCaip).toList();
      if (chains.isEmpty) {
        await rejectLiveProposal(proposalId);
        throw StateError(
          'No supported EVM chains overlap. Auvora WC supports '
          '${WcChainCatalog.supportedEip155Chains.join(", ")}.',
        );
      }
      filtered['eip155'] = Namespace(
        accounts: [
          for (final chain in chains)
            for (final account in accounts)
              if (account.isNotEmpty) '$chain:$account',
        ],
        methods: List<String>.from(WcChainCatalog.supportedEvmMethods),
        events: List<String>.from(WcChainCatalog.supportedEvents),
        chains: chains,
      );
    }

    final response = await _walletKit
        .approveSession(id: proposalId, namespaces: filtered)
        .timeout(const Duration(seconds: 20));

    _pendingProposals.remove(proposalId);
    final session = response.session;
    if (session == null) {
      throw StateError('Reown approveSession returned no session.');
    }
    final networks = <String>[];
    final accountList = <String>[];
    session.namespaces.forEach((_, ns) {
      networks.addAll(ns.chains ?? const []);
      accountList.addAll(ns.accounts);
    });
    final snapshot = WalletConnectSessionSnapshot(
      sessionId: session.topic,
      topic: session.topic,
      status: WalletConnectSessionStatus.active,
      peerName: session.peer.metadata.name,
      peerUrl: session.peer.metadata.url,
      networks: WcChainCatalog.labelsForCaips(networks),
      permissions: const [
        DappPermissionCode.viewAddresses,
        DappPermissionCode.viewBalances,
        DappPermissionCode.requestSignatures,
        DappPermissionCode.requestTransactions,
        DappPermissionCode.sessionManage,
      ],
      accounts: accountList.isEmpty ? accounts : accountList,
      createdAt: DateTime.now(),
      expiresAt: DateTime.fromMillisecondsSinceEpoch(session.expiry * 1000),
      protocolVersion: protocolVersion,
    );
    _sessions[snapshot.sessionId] = snapshot;
    return snapshot;
  }

  @override
  Future<void> rejectLiveProposal(int proposalId) async {
    _pendingProposals.remove(proposalId);
    try {
      await _walletKit.rejectSession(
        id: proposalId,
        reason: Errors.getSdkError(Errors.USER_REJECTED).toSignError(),
      );
    } catch (_) {
      // Proposal may already be expired on the relay.
    }
  }

  @override
  Future<WalletConnectSessionSnapshot> rejectSession(String proposalId) async {
    final asInt = int.tryParse(proposalId);
    if (asInt != null) {
      await rejectLiveProposal(asInt);
    }
    return WalletConnectSessionSnapshot(
      sessionId: proposalId,
      topic: 'rejected',
      status: WalletConnectSessionStatus.rejected,
      peerName: 'Unknown app',
      networks: const [],
      permissions: const [],
      accounts: const [],
      createdAt: DateTime.now(),
      expiresAt: DateTime.now(),
      protocolVersion: protocolVersion,
    );
  }

  @override
  Future<WalletConnectSessionSnapshot?> restoreSession(String sessionId) async {
    try {
      final all = _walletKit.sessions.getAll();
      for (final s in all) {
        if (s.topic == sessionId) {
          final expired = DateTime.now().millisecondsSinceEpoch ~/ 1000 > s.expiry;
          final networks = <String>[];
          final accounts = <String>[];
          s.namespaces.forEach((_, ns) {
            networks.addAll(ns.chains ?? const []);
            accounts.addAll(ns.accounts);
          });
          final snapshot = WalletConnectSessionSnapshot(
            sessionId: s.topic,
            topic: s.topic,
            status: expired
                ? WalletConnectSessionStatus.expired
                : WalletConnectSessionStatus.active,
            peerName: s.peer.metadata.name,
            peerUrl: s.peer.metadata.url,
            networks: WcChainCatalog.labelsForCaips(networks),
            permissions: const [
              DappPermissionCode.viewAddresses,
              DappPermissionCode.requestSignatures,
              DappPermissionCode.requestTransactions,
            ],
            accounts: accounts,
            createdAt: DateTime.now(),
            expiresAt: DateTime.fromMillisecondsSinceEpoch(s.expiry * 1000),
            protocolVersion: protocolVersion,
          );
          _sessions[sessionId] = snapshot;
          return snapshot;
        }
      }
    } catch (_) {}
    return _sessions[sessionId];
  }

  @override
  Future<void> terminateSession(String sessionId) async {
    try {
      await _walletKit.disconnectSession(
        topic: sessionId,
        reason: Errors.getSdkError(Errors.USER_DISCONNECTED).toSignError(),
      );
    } catch (_) {}
    final existing = _sessions[sessionId];
    if (existing != null) {
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
  }

  @override
  Future<void> respondLiveRequest({
    required String topic,
    required int requestId,
    String? result,
    String? errorMessage,
    int errorCode = 5001,
  }) async {
    // If a handler is awaiting UI, complete it instead of double-responding.
    if (_requestCompleters.containsKey(requestId)) {
      completeLiveRequest(
        requestId,
        result: result,
        errorMessage: errorMessage,
        errorCode: errorCode,
      );
      return;
    }

    if (result != null) {
      await _walletKit.respondSessionRequest(
        topic: topic,
        response: JsonRpcResponse(
          id: requestId,
          jsonrpc: '2.0',
          result: result,
        ),
      );
      return;
    }

    await _walletKit.respondSessionRequest(
      topic: topic,
      response: JsonRpcResponse(
        id: requestId,
        jsonrpc: '2.0',
        error: JsonRpcError(
          code: errorCode,
          message: errorMessage ?? 'User rejected method',
        ),
      ),
    );
  }

  bool get handlersRegistered => _handlersRegistered;

  ReownWalletKit get walletKit => _walletKit;

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    for (final c in _requestCompleters.values) {
      if (!c.isCompleted) {
        c.complete(
          const _LiveRequestDecision(
            errorCode: 5001,
            errorMessage: 'Wallet shutting down',
          ),
        );
      }
    }
    _requestCompleters.clear();
    try {
      _walletKit.onSessionProposal.unsubscribe(_onSessionProposal);
      _walletKit.onSessionProposalError.unsubscribe(_onSessionProposalError);
      _walletKit.onSessionDelete.unsubscribe(_onSessionDelete);
      _walletKit.onSessionRequest.unsubscribe(_onSessionRequest);
    } catch (_) {}
    await _proposalController.close();
    await _requestController.close();
    await _deleteController.close();
  }
}

class _LiveRequestDecision {
  const _LiveRequestDecision({
    this.result,
    this.errorMessage,
    this.errorCode = 5001,
  });

  final String? result;
  final String? errorMessage;
  final int errorCode;
}
