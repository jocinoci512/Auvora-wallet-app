import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../release/release_config.dart';
import '../security/security_models.dart';
import 'evm_local_signer.dart';
import 'known_catalog.dart';
import 'models.dart';
import 'permission_catalog.dart';
import 'wc_chain_catalog.dart';
import 'wc_request_parser.dart';
import 'wallet_connect_provider.dart';

class ConnectionsController extends ChangeNotifier {
  ConnectionsController({WalletConnectProviderPort? walletConnect})
      : walletConnect = walletConnect ?? PreviewWalletConnectProvider();

  WalletConnectProviderPort walletConnect;
  SharedPreferences? _prefs;
  bool loading = true;
  String? liveRelayStatus;
  String? bootstrapFallbackReason;

  List<ConnectedAppSession> sessions = const [];
  List<DappConnectionRequest> pendingRequests = const [];
  List<SignatureRequest> pendingSignatures = const [];
  List<DappTransactionRequest> pendingTransactions = const [];
  List<Web3ActivityEvent> activity = const [];
  final Set<String> _consumedRequestHashes = {};
  final List<StreamSubscription<dynamic>> _liveSubs = [];
  Future<String?> Function()? _mnemonicProvider;
  final _signer = const EvmLocalSigner();

  static const _kSessions = 'auvora_connections_sessions_v1';
  static const _kPending = 'auvora_connections_pending_v1';
  static const _kSignatures = 'auvora_connections_signatures_v1';
  static const _kTransactions = 'auvora_connections_transactions_v1';
  static const _kActivity = 'auvora_connections_activity_v1';
  static const _defaultSessionTtl = Duration(days: 7);

  List<ConnectedAppSession> get activeSessions =>
      sessions.where((s) => s.active).toList(growable: false);

  bool get isLiveRelay => walletConnect.isLiveRelay && walletConnect.isInitialized;

  /// Snapshot for Security Center score / checkup.
  List<ConnectedDapp> get connectedDappsSummary => [
        for (final session in activeSessions)
          ConnectedDapp(
            id: session.id,
            name: session.label,
            website: session.origin,
            connectedAt: session.connectedAt,
            permissions: [
              for (final code in session.activePermissionCodes) permissionInfoFor(code).title,
            ],
            warning: session.warning ??
                (session.activePermissionCodes.contains(DappPermissionCode.requestTransactions)
                    ? 'Can request transactions that move funds.'
                    : null),
          ),
      ];

  /// Attach mnemonic accessor for local WC signing (never logged).
  void attachMnemonicProvider(Future<String?> Function() provider) {
    _mnemonicProvider = provider;
  }

  /// Swap provider after [WalletConnectBootstrap] (preview → live or fallback).
  Future<void> attachWalletConnectProvider(
    WalletConnectProviderPort provider, {
    String? fallbackReason,
  }) async {
    for (final s in _liveSubs) {
      await s.cancel();
    }
    _liveSubs.clear();
    await walletConnect.dispose();
    walletConnect = provider;
    bootstrapFallbackReason = fallbackReason;
    liveRelayStatus = provider.isLiveRelay
        ? 'Live Reown WalletKit'
        : (fallbackReason ?? 'Preview WalletConnect (local only)');
    _bindLiveStreams();
    notifyListeners();
  }

  void _bindLiveStreams() {
    if (!walletConnect.isLiveRelay) return;
    _liveSubs.add(walletConnect.sessionProposals.listen(_onLiveProposal));
    _liveSubs.add(walletConnect.sessionRequests.listen(_onLiveRequest));
    _liveSubs.add(walletConnect.sessionDeletes.listen(_onLiveSessionDelete));
  }

  Future<void> _onLiveProposal(LiveSessionProposalEvent event) async {
    await bootstrap();
    final origin = event.proposerUrl.isNotEmpty
        ? event.proposerUrl
        : 'auvora://walletconnect/pending';
    final known = lookupKnownDapp(origin);
    final chains = {
      ...event.requiredChains,
      ...event.optionalChains,
    };
    final unsupported = chains.where((c) => !WcChainCatalog.isSupportedCaip(c)).toList();
    final supported = chains.where(WcChainCatalog.isSupportedCaip).toList();
    final https = origin.toLowerCase().startsWith('https://');
    final warnings = <String>[
      if (unsupported.isNotEmpty)
        'Unsupported chains requested (ignored): ${unsupported.join(", ")}',
      if (supported.isEmpty) 'No supported EVM chains in this proposal — reject unless metadata is wrong.',
      if (event.methods.any(WcChainCatalog.isUnsafeRejectedMethod))
        'dApp requested eth_sign — Auvora will reject that method.',
      if (event.verifyRisk != null && event.verifyRisk!.toLowerCase().contains('invalid'))
        'Reown Verify flagged this origin — treat as untrusted.',
      'Live WalletConnect proposal — approve only if you trust this dApp.',
    ];
    final request = DappConnectionRequest(
      id: _id('req'),
      appName: event.proposerName,
      origin: origin,
      networks: supported.isEmpty
          ? WcChainCatalog.labelsForCaips(chains)
          : WcChainCatalog.labelsForCaips(supported),
      account: 'Primary account',
      permissions: const [
        DappPermissionCode.viewAddresses,
        DappPermissionCode.viewBalances,
        DappPermissionCode.requestSignatures,
        DappPermissionCode.requestTransactions,
        DappPermissionCode.sessionManage,
      ],
      method: ConnectionMethod.walletConnectUri,
      createdAt: DateTime.now(),
      status: ConnectionRequestStatus.pending,
      trust: TrustIndicators(
        verifiedDomain: known?.verified == true,
        https: https,
        knownProject: known != null,
        unknownApplication: known == null,
      ),
      faviconHint: event.proposerName.isNotEmpty
          ? event.proposerName.substring(0, 1).toUpperCase()
          : '?',
      pairUri: null,
      riskWarnings: warnings,
      wcProposalId: event.proposalId,
      proposerIcon: event.proposerIcon,
      requestedMethods: event.methods,
      requestedEvents: event.events,
    );
    pendingRequests = [request, ...pendingRequests];
    await _persistPending();
    await _addActivity(
      kind: Web3ActivityKind.deepLink,
      title: 'Live session proposal',
      detail: '${event.proposerName} · ${event.proposerUrl}',
      appName: event.proposerName,
      origin: origin,
      status: Web3ActivityStatus.pending,
    );
    notifyListeners();
  }

  Future<void> _onLiveRequest(LiveSessionRequestEvent event) async {
    await bootstrap();
    final parsed = WcRequestParser.parse(
      method: event.method,
      chainId: event.chainId,
      params: event.params,
    );
    final session = sessions
        .where((s) => s.topic == event.topic || s.id == event.topic)
        .cast<ConnectedAppSession?>()
        .followedBy([activeSessions.isNotEmpty ? activeSessions.first : null])
        .first;

    if (parsed.kind == WcRequestKind.unsafeRejected ||
        parsed.kind == WcRequestKind.unsupported) {
      await walletConnect.respondLiveRequest(
        topic: event.topic,
        requestId: event.requestId,
        errorCode: 5101,
        errorMessage: parsed.rejectReason ?? 'Unsupported method',
      );
      await _addActivity(
        kind: Web3ActivityKind.security,
        title: 'Rejected WC method',
        detail: parsed.summary,
        appName: session?.label,
        origin: session?.origin,
        status: Web3ActivityStatus.rejected,
      );
      notifyListeners();
      return;
    }

    if (parsed.kind == WcRequestKind.sendTransaction) {
      final preview = parsed.txPreview!;
      final request = DappTransactionRequest(
        id: _id('dtx'),
        sessionId: session?.id ?? event.topic,
        appName: session?.label ?? 'Connected dApp',
        origin: session?.origin ?? 'walletconnect',
        recipient: preview.to,
        network: parsed.networkLabel,
        assetSymbol: 'ETH',
        amount: double.tryParse(preview.valueEthLabel.split(' ').first) ?? 0,
        feeEstimate: preview.gas != null
            ? 'Gas ${preview.gas} (estimate from dApp — not live fee oracle)'
            : 'Fee estimate unavailable until broadcast audit',
        purpose: 'eth_sendTransaction',
        createdAt: DateTime.now(),
        risk: ConnectionRisk.elevated,
        simulationNote: ReleaseConfig.liveBroadcastEnabled
            ? 'Live broadcast enabled'
            : 'Live broadcast is OFF — approving will refuse to broadcast and return an error to the dApp.',
        warnings: [
          'This can move funds if broadcast were enabled.',
          if (preview.hasContractInteraction) 'Contract calldata present — review carefully.',
          if (!ReleaseConfig.liveBroadcastEnabled)
            'Kill switch: liveBroadcastEnabled=false — WC cannot bypass.',
        ],
        wcTopic: event.topic,
        wcRequestId: event.requestId,
        wcChainId: event.chainId,
        wcTxJson: jsonEncode(
          event.params is List && (event.params as List).isNotEmpty
              ? (event.params as List).first
              : event.params,
        ),
      );
      pendingTransactions = [request, ...pendingTransactions];
      await _persistTransactions();
      notifyListeners();
      return;
    }

    final kind = parsed.kind == WcRequestKind.signTypedDataV4
        ? SignatureKind.typedData
        : SignatureKind.message;
    String? rawPayload;
    if (parsed.kind == WcRequestKind.personalSign) {
      final list = event.params is List ? event.params as List : const [];
      rawPayload = list.isNotEmpty ? list.first.toString() : '';
      if (list.length >= 2) {
        final a = list[0].toString();
        final b = list[1].toString();
        rawPayload = (a.toLowerCase().startsWith('0x') && a.length == 42) ? b : a;
      }
    } else if (parsed.kind == WcRequestKind.signTypedDataV4) {
      final list = event.params is List ? event.params as List : const [];
      if (list.length >= 2) {
        final raw = list[1];
        rawPayload = raw is String ? raw : jsonEncode(raw);
      }
    }

    final request = SignatureRequest(
      id: _id('sig'),
      sessionId: session?.id ?? event.topic,
      appName: session?.label ?? 'Connected dApp',
      origin: session?.origin ?? 'walletconnect',
      kind: kind,
      purpose: parsed.method,
      payloadSummary: parsed.summary,
      network: parsed.networkLabel,
      createdAt: DateTime.now(),
      risk: parsed.canMoveFunds ? ConnectionRisk.elevated : ConnectionRisk.medium,
      canMoveFunds: parsed.canMoveFunds,
      requestHash: sha256.convert(utf8.encode('${event.topic}|${event.requestId}')).toString(),
      walletLabel: parsed.fromAddress ??
          (session != null && session.accounts.isNotEmpty
              ? session.accounts.first
              : 'Primary account'),
      wcTopic: event.topic,
      wcRequestId: event.requestId,
      wcMethod: event.method,
      wcChainId: event.chainId,
      wcRawPayload: rawPayload,
    );
    pendingSignatures = [request, ...pendingSignatures];
    await _persistSignatures();
    notifyListeners();
  }

  Future<void> _onLiveSessionDelete(String topic) async {
    await bootstrap();
    final match = sessions.where((s) => s.id == topic || s.topic == topic);
    if (match.isEmpty) return;
    final session = match.first;
    sessions = [
      for (final s in sessions)
        if (s.id == session.id)
          s.copyWith(active: false, warning: 'Disconnected by dApp or relay.')
        else
          s,
    ];
    await _addActivity(
      kind: Web3ActivityKind.disconnected,
      title: 'Session ended remotely',
      detail: '${session.label} disconnected.',
      appName: session.label,
      origin: session.origin,
      status: Web3ActivityStatus.confirmed,
    );
    await _persistSessions();
    notifyListeners();
  }

  Future<void> bootstrap() async {
    if (!loading) return;
    _prefs ??= await SharedPreferences.getInstance();
    sessions = _readList(_kSessions, ConnectedAppSession.fromJson);
    pendingRequests = _readList(_kPending, DappConnectionRequest.fromJson)
        .where((r) => r.status == ConnectionRequestStatus.pending)
        .toList();
    pendingSignatures = _readList(_kSignatures, SignatureRequest.fromJson)
        .where((r) => r.status == ConnectionRequestStatus.pending)
        .toList();
    pendingTransactions = _readList(_kTransactions, DappTransactionRequest.fromJson)
        .where((r) => r.status == ConnectionRequestStatus.pending)
        .toList();
    activity = _readList(_kActivity, Web3ActivityEvent.fromJson);
    // Closed Beta: start empty — never invent connected apps or activity.
    loading = false;
    await expireStaleSessions(recordActivity: true);
    notifyListeners();
  }

  /// Mark expired sessions inactive (session expiration + validation).
  Future<int> expireStaleSessions({bool recordActivity = false}) async {
    final now = DateTime.now();
    var changed = 0;
    final next = <ConnectedAppSession>[];
    for (final s in sessions) {
      if (s.active && s.expiresAt != null && now.isAfter(s.expiresAt!)) {
        changed++;
        next.add(s.copyWith(active: false, warning: 'Session expired — reconnect with fresh approval.'));
        if (recordActivity) {
          activity = [
            Web3ActivityEvent(
              id: _id('act'),
              kind: Web3ActivityKind.sessionExpired,
              title: 'Session expired',
              detail: '${s.label} expired. Reconnect requires a new approval.',
              timestamp: now,
              status: Web3ActivityStatus.confirmed,
              appName: s.label,
              origin: s.origin,
            ),
            ...activity,
          ];
        }
      } else {
        next.add(s);
      }
    }
    if (changed > 0) {
      sessions = next;
      await _persistSessions();
      if (recordActivity) await _persistActivity();
      notifyListeners();
    }
    return changed;
  }

  // --- Pairing / approval -------------------------------------------------

  /// Accept a WalletConnect URI, pairing code, or deep-link payload.
  Future<DappConnectionRequest> createPairingRequest({
    required String rawInput,
    required ConnectionMethod method,
    String? account,
  }) async {
    await bootstrap();
    final validation = walletConnect.validateInboundUri(rawInput);
    final isPairingCode =
        method == ConnectionMethod.desktopPairing || method == ConnectionMethod.mobilePairing;
    if (!validation.valid && !isPairingCode) {
      final looksLikeScheme = rawInput.trim().contains(':');
      if (looksLikeScheme &&
          (validation.kind == DeepLinkKind.invalid || validation.kind == DeepLinkKind.unsupported)) {
        throw ArgumentError(validation.message ?? 'Invalid pairing input');
      }
    }
    final effectiveInput = validation.extractedUri ?? rawInput;

    // Live Reown path: pair wc: URI and wait for session proposal (never auto-approve).
    if (walletConnect.isLiveRelay &&
        effectiveInput.toLowerCase().startsWith('wc:') &&
        !isPairingCode) {
      try {
        await walletConnect.pairUri(effectiveInput).timeout(const Duration(seconds: 25));
      } on TimeoutException {
        throw StateError('Pairing timed out. Check internet and try a fresh QR/URI.');
      } catch (e) {
        if (e is ArgumentError || e is StateError) rethrow;
        throw StateError('Pairing failed. URI may be expired or relay unavailable.');
      }
      // Proposal arrives via stream → pendingRequests. Return a placeholder marker.
      await Future<void>.delayed(const Duration(milliseconds: 400));
      final livePending = pendingRequests.where((r) => r.wcProposalId != null).toList();
      if (livePending.isNotEmpty) {
        return livePending.first;
      }
      // Still waiting — surface a synthetic pending that UI can show as "waiting".
      final waiting = DappConnectionRequest(
        id: _id('req'),
        appName: 'Waiting for dApp proposal…',
        origin: 'auvora://walletconnect/pairing',
        networks: WcChainCatalog.labelsForCaips(WcChainCatalog.supportedEip155Chains),
        account: account?.trim().isNotEmpty == true ? account!.trim() : 'Primary account',
        permissions: const [
          DappPermissionCode.viewAddresses,
          DappPermissionCode.requestSignatures,
        ],
        method: method,
        createdAt: DateTime.now(),
        status: ConnectionRequestStatus.pending,
        trust: const TrustIndicators(unknownApplication: true),
        pairUri: effectiveInput,
        riskWarnings: const [
          'Paired with Reown relay — waiting for session proposal. Never auto-approved.',
        ],
      );
      pendingRequests = [waiting, ...pendingRequests];
      await _persistPending();
      notifyListeners();
      return waiting;
    }

    final parsed = _parsePairInput(effectiveInput, method: method);
    final known = lookupKnownDapp(parsed.origin);
    final previously = sessions.any(
      (s) => _normalizeOrigin(s.origin) == _normalizeOrigin(parsed.origin),
    );
    final synthetic = parsed.syntheticOrigin;
    final https = !synthetic && parsed.origin.toLowerCase().startsWith('https://');
    final unknown = !synthetic && known == null && !previously;
    final trust = TrustIndicators(
      verifiedDomain: !synthetic && known?.verified == true,
      https: https,
      previouslyConnected: previously,
      knownProject: !synthetic && known != null,
      unknownApplication: unknown,
      recentlyRegisteredHint: unknown,
    );
    final permissions = parsed.permissions;
    final warnings = <String>[
      if (synthetic) 'Proposer metadata unavailable (preview) — this is not a public website origin.',
      if (!trust.anyVerified && !synthetic) 'We can’t verify this site yet.',
      if (!https && !synthetic) 'This origin is not using HTTPS.',
      if (lookalikeHint(parsed.origin) case final hint?) hint,
      if (permissions.contains(DappPermissionCode.requestTransactions))
        'This connection can request transactions that move funds or assets.',
      if (pendingRequests.length >= 2) 'You already have other pending connection requests.',
      if (unknown) 'Unknown application — review permissions carefully. Why: we have no prior connection or catalog entry for this origin.',
      if (parsed.note case final note?) note,
      if (!walletConnect.isLiveRelay)
        'Preview WalletConnect — not a live relay session. Approving stores a local session only.',
      if (walletConnect.isLiveRelay)
        'Live Reown relay is active for this build.',
    ];

    final request = DappConnectionRequest(
      id: _id('req'),
      appName: synthetic ? parsed.appName : (known?.name ?? parsed.appName),
      origin: parsed.origin,
      networks: parsed.networks,
      account: account?.trim().isNotEmpty == true ? account!.trim() : 'Primary account',
      permissions: permissions,
      method: method,
      createdAt: DateTime.now(),
      status: ConnectionRequestStatus.pending,
      trust: trust,
      faviconHint: parsed.appName.substring(0, 1).toUpperCase(),
      pairUri: parsed.pairUri,
      riskWarnings: warnings,
    );
    pendingRequests = [request, ...pendingRequests];
    await _persistPending();
    notifyListeners();
    return request;
  }

  /// Ingest OS / QR / paste deep links; returns a pending connection request when applicable.
  Future<DappConnectionRequest?> handleInboundDeepLink(String raw) async {
    await bootstrap();
    final validation = walletConnect.validateInboundUri(raw);
    await _addActivity(
      kind: Web3ActivityKind.deepLink,
      title: validation.valid ? 'Deep link received' : 'Deep link rejected',
      detail: validation.message ?? raw,
      status: validation.valid ? Web3ActivityStatus.confirmed : Web3ActivityStatus.rejected,
    );
    if (!validation.valid || validation.extractedUri == null) {
      return null;
    }
    if (validation.kind == DeepLinkKind.transactionRequest ||
        validation.kind == DeepLinkKind.authentication) {
      // Auth / tx deep links never auto-approve — surface as activity only.
      return null;
    }
    final method = validation.kind == DeepLinkKind.walletConnectUri
        ? ConnectionMethod.walletConnectUri
        : ConnectionMethod.deepLink;
    return createPairingRequest(rawInput: validation.extractedUri!, method: method);
  }

  Future<ConnectedAppSession?> approveConnection(String requestId) async {
    await bootstrap();
    final index = pendingRequests.indexWhere((r) => r.id == requestId);
    if (index < 0) return null;
    final request = pendingRequests[index];
    final now = DateTime.now();
    final normalized = _normalizeOrigin(request.origin);

    // Live Reown proposal approval.
    if (request.wcProposalId != null && walletConnect.isLiveRelay) {
      final evmAddress = request.account.startsWith('0x')
          ? request.account
          : (request.account.contains(':')
              ? request.account.split(':').last
              : request.account);
      try {
        final snapshot = await walletConnect.approveLiveProposal(
          proposalId: request.wcProposalId!,
          accounts: [if (evmAddress.isNotEmpty) evmAddress],
        );
        final session = ConnectedAppSession(
          id: snapshot.sessionId,
          appName: snapshot.peerName,
          origin: snapshot.peerUrl ?? request.origin,
          networks: snapshot.networks,
          accounts: snapshot.accounts,
          method: request.method,
          connectedAt: now,
          lastUsedAt: now,
          trust: request.trust.copyWithPreviouslyConnected(true),
          grants: [
            for (final code in request.permissions)
              PermissionGrant(
                id: _id('grant'),
                sessionId: snapshot.sessionId,
                code: code,
                grantedAt: now,
                lastUsedAt: now,
              ),
          ],
          faviconHint: request.faviconHint,
          warning: 'Live Reown session — disconnect anytime in Permission Center.',
          active: true,
          topic: snapshot.topic,
          protocolVersion: snapshot.protocolVersion,
          expiresAt: snapshot.expiresAt,
          pairUri: request.pairUri,
        );
        sessions = [
          session,
          for (final s in sessions)
            if (s.id != session.id && _normalizeOrigin(s.origin) != _normalizeOrigin(session.origin)) s,
        ];
        pendingRequests = pendingRequests
            .where((r) => r.id != requestId)
            .toList();
        await _addActivity(
          kind: Web3ActivityKind.connected,
          title: 'Connected ${session.label}',
          detail: 'Live Reown session for ${session.origin}.',
          appName: session.label,
          origin: session.origin,
          status: Web3ActivityStatus.confirmed,
        );
        await _persistSessions();
        await _persistPending();
        notifyListeners();
        return session;
      } catch (e) {
        await _addActivity(
          kind: Web3ActivityKind.rejected,
          title: 'Live session approval failed',
          detail: e.toString(),
          appName: request.appName,
          origin: request.origin,
          status: Web3ActivityStatus.rejected,
        );
        rethrow;
      }
    }

    // Upsert by origin — avoid duplicate active sessions for the same dApp.
    final existing = sessions.where((s) => _normalizeOrigin(s.origin) == normalized).toList();
    final sessionId = existing.isNotEmpty ? existing.first.id : _id('sess');

    final grants = [
      for (final code in request.permissions)
        PermissionGrant(
          id: _id('grant'),
          sessionId: sessionId,
          code: code,
          grantedAt: now,
          lastUsedAt: now,
        ),
    ];
    final session = ConnectedAppSession(
      id: sessionId,
      appName: request.appName,
      origin: request.origin,
      networks: request.networks,
      accounts: [request.account],
      method: request.method,
      connectedAt: existing.isNotEmpty ? existing.first.connectedAt : now,
      lastUsedAt: now,
      trust: request.trust.copyWithPreviouslyConnected(true),
      grants: grants,
      displayName: existing.isNotEmpty ? existing.first.displayName : null,
      faviconHint: request.faviconHint,
      warning: request.permissions.contains(DappPermissionCode.requestTransactions)
          ? 'Can request transactions that move funds.'
          : (request.riskWarnings.isNotEmpty && !request.trust.anyVerified
              ? 'Unverified origin — review carefully.'
              : null),
      active: true,
      topic: existing.isNotEmpty ? existing.first.topic : 'topic_${sessionId.hashCode.toRadixString(16)}',
      protocolVersion: walletConnect.protocolVersion,
      expiresAt: now.add(_defaultSessionTtl),
      pairUri: request.pairUri,
      lastRestoredAt: existing.isNotEmpty ? now : null,
    );
    sessions = [
      session,
      for (final s in sessions)
        if (_normalizeOrigin(s.origin) != normalized) s,
    ];
    pendingRequests = [
      for (final r in pendingRequests)
        if (r.id == requestId) r.copyWith(status: ConnectionRequestStatus.approved) else r,
    ].where((r) => r.status == ConnectionRequestStatus.pending).toList();
    await _addActivity(
      kind: Web3ActivityKind.connected,
      title: 'Connected ${session.label}',
      detail: walletConnect.isLiveRelay
          ? 'Session approved for ${session.origin}.'
          : 'Preview session approved for ${session.origin}. Not a live WalletConnect relay.',
      appName: session.label,
      origin: session.origin,
      status: Web3ActivityStatus.confirmed,
    );
    await _addActivity(
      kind: Web3ActivityKind.approved,
      title: 'Connection approved',
      detail: plainLanguagePermissions(request.permissions),
      appName: session.label,
      origin: session.origin,
      status: Web3ActivityStatus.confirmed,
    );
    await _persistSessions();
    await _persistPending();
    notifyListeners();
    return session;
  }

  Future<void> rejectConnection(String requestId) async {
    await bootstrap();
    final match = pendingRequests.where((r) => r.id == requestId);
    if (match.isEmpty) return;
    final request = match.first;
    if (request.wcProposalId != null && walletConnect.isLiveRelay) {
      try {
        await walletConnect.rejectLiveProposal(request.wcProposalId!);
      } catch (_) {}
    }
    pendingRequests = pendingRequests.where((r) => r.id != requestId).toList();
    await _addActivity(
      kind: Web3ActivityKind.rejected,
      title: 'Connection rejected',
      detail: 'Rejected ${request.appName} (${request.origin}).',
      appName: request.appName,
      origin: request.origin,
      status: Web3ActivityStatus.rejected,
    );
    await _persistPending();
    notifyListeners();
  }

  // --- Session management -------------------------------------------------

  Future<void> disconnectSession(String sessionId) async {
    await bootstrap();
    final match = sessions.where((s) => s.id == sessionId);
    if (match.isEmpty) return;
    final session = match.first;
    sessions = [
      for (final s in sessions)
        if (s.id == sessionId) s.copyWith(active: false) else s,
    ];
    await walletConnect.terminateSession(sessionId);
    await _addActivity(
      kind: Web3ActivityKind.disconnected,
      title: 'Disconnected ${session.label}',
      detail: 'Session ended for ${session.origin}.',
      appName: session.label,
      origin: session.origin,
      status: Web3ActivityStatus.confirmed,
    );
    await _persistSessions();
    notifyListeners();
  }

  /// Disconnect every active session (auth required by UI).
  Future<int> disconnectAllSessions() async {
    await bootstrap();
    final active = activeSessions;
    if (active.isEmpty) return 0;
    for (final session in active) {
      await walletConnect.terminateSession(session.id);
    }
    sessions = [
      for (final s in sessions)
        if (s.active) s.copyWith(active: false) else s,
    ];
    await _addActivity(
      kind: Web3ActivityKind.disconnected,
      title: 'Disconnected all apps',
      detail: 'Ended ${active.length} active session${active.length == 1 ? '' : 's'}.',
      status: Web3ActivityStatus.confirmed,
    );
    await _persistSessions();
    notifyListeners();
    return active.length;
  }

  /// Attempt automatic reconnection validation for an existing session topic.
  /// Expired sessions require [reconnectSession] (fresh approval).
  Future<ConnectedAppSession?> restoreSession(String sessionId) async {
    await bootstrap();
    final index = sessions.indexWhere((s) => s.id == sessionId);
    if (index < 0) return null;
    final current = sessions[index];
    if (current.isExpired) {
      await expireStaleSessions(recordActivity: true);
      return sessions.firstWhere((s) => s.id == sessionId);
    }
    // Local preview sessions restore from persistence; live providers may re-validate.
    // Hard timeout — optional WC must never block dashboard / reconnect UI.
    WalletConnectSessionSnapshot? snapshot;
    try {
      snapshot = await walletConnect
          .restoreSession(sessionId)
          .timeout(const Duration(seconds: 8));
    } catch (_) {
      snapshot = null;
    }
    final now = DateTime.now();
    if (snapshot != null && snapshot.status == WalletConnectSessionStatus.expired) {
      final expired = current.copyWith(
        active: false,
        warning: 'Session could not be restored — reconnect with fresh approval.',
      );
      sessions = [
        for (var i = 0; i < sessions.length; i++)
          if (i == index) expired else sessions[i],
      ];
      await _addActivity(
        kind: Web3ActivityKind.sessionExpired,
        title: 'Restore failed',
        detail: '${current.label} needs a new connection approval.',
        appName: current.label,
        origin: current.origin,
        status: Web3ActivityStatus.rejected,
      );
      await _persistSessions();
      notifyListeners();
      return expired;
    }
    final restored = current.copyWith(
      active: true,
      lastUsedAt: now,
      lastRestoredAt: now,
    );
    sessions = [
      for (var i = 0; i < sessions.length; i++)
        if (i == index) restored else sessions[i],
    ];
    await _addActivity(
      kind: Web3ActivityKind.sessionRestored,
      title: 'Session restored',
      detail: snapshot != null
          ? '${restored.label} reconnect validated via ${walletConnect.name}.'
          : '${restored.label} restored from local session store (preview).',
      appName: restored.label,
      origin: restored.origin,
      status: Web3ActivityStatus.confirmed,
    );
    await _persistSessions();
    notifyListeners();
    return restored;
  }

  /// Reconnect creates a fresh pending approval — never silently restore grants.
  Future<DappConnectionRequest> reconnectSession(String sessionId) async {
    await bootstrap();
    final match = sessions.where((s) => s.id == sessionId);
    if (match.isEmpty) {
      throw StateError('Session not found');
    }
    final session = match.first;
    return createPairingRequest(
      rawInput: session.pairUri ?? session.origin,
      method: session.method,
      account: session.accounts.isNotEmpty ? session.accounts.first : null,
    );
  }

  Future<void> renameSession(String sessionId, String displayName) async {
    await bootstrap();
    final next = displayName.trim();
    sessions = [
      for (final s in sessions)
        if (s.id == sessionId) s.copyWith(displayName: next.isEmpty ? null : next) else s,
    ];
    final session = sessions.firstWhere((s) => s.id == sessionId);
    await _addActivity(
      kind: Web3ActivityKind.renamed,
      title: 'Renamed connection',
      detail: '${session.appName} is now labeled “${session.label}”.',
      appName: session.label,
      origin: session.origin,
      status: Web3ActivityStatus.confirmed,
    );
    await _persistSessions();
    notifyListeners();
  }

  Future<void> revokePermission({required String sessionId, required String grantId}) async {
    await bootstrap();
    final index = sessions.indexWhere((s) => s.id == sessionId);
    if (index < 0) return;
    final current = sessions[index];
    final grants = [
      for (final g in current.grants)
        if (g.id == grantId) g.copyWith(revoked: true) else g,
    ];
    final session = current.copyWith(grants: grants, lastUsedAt: DateTime.now());
    sessions = [
      for (var i = 0; i < sessions.length; i++)
        if (i == index) session else sessions[i],
    ];
    await _addActivity(
      kind: Web3ActivityKind.permissionRevoked,
      title: 'Permission revoked',
      detail: 'A permission was revoked for ${session.label}.',
      appName: session.label,
      origin: session.origin,
      status: Web3ActivityStatus.confirmed,
    );
    await _persistSessions();
    notifyListeners();
  }

  Future<void> touchSession(String sessionId) async {
    sessions = [
      for (final s in sessions)
        if (s.id == sessionId) s.copyWith(lastUsedAt: DateTime.now()) else s,
    ];
    await _persistSessions();
    notifyListeners();
  }

  // --- Sign / tx requests -------------------------------------------------

  Future<SignatureRequest> enqueueSignatureRequest({
    required String sessionId,
    SignatureKind kind = SignatureKind.message,
    String? purpose,
    String? payloadSummary,
    bool? canMoveFunds,
  }) async {
    await bootstrap();
    final session = sessions.firstWhere((s) => s.id == sessionId && s.active);
    final summary = payloadSummary ??
        (kind == SignatureKind.typedData
            ? 'Typed data · Permit-style fields · domain ${session.origin}'
            : 'Message · “Welcome to ${session.appName}” · no funds move from this message alone');
    final looksLikePermit = kind == SignatureKind.typedData ||
        summary.toLowerCase().contains('permit') ||
        summary.toLowerCase().contains('allowance') ||
        (purpose?.toLowerCase().contains('permit') ?? false);
    final fundsRisk = canMoveFunds ?? looksLikePermit;
    final hash = sha256
        .convert(utf8.encode('$sessionId|${kind.name}|$summary|${DateTime.now().millisecondsSinceEpoch ~/ 1000}'))
        .toString();
    if (_consumedRequestHashes.contains(hash)) {
      throw StateError('Duplicate signature request blocked (replay protection)');
    }
    final request = SignatureRequest(
      id: _id('sig'),
      sessionId: session.id,
      appName: session.label,
      origin: session.origin,
      kind: kind,
      purpose: purpose ??
          (looksLikePermit
              ? 'Authorize a spending allowance (typed data)'
              : kind == SignatureKind.typedData
                  ? 'Confirm typed data for a dApp action'
                  : 'Prove you control this account'),
      payloadSummary: summary,
      network: session.networks.isNotEmpty ? session.networks.first : 'ETHEREUM',
      createdAt: DateTime.now(),
      risk: fundsRisk ? ConnectionRisk.elevated : ConnectionRisk.medium,
      canMoveFunds: fundsRisk,
      requestHash: hash,
      walletLabel: session.accounts.isNotEmpty ? session.accounts.first : 'Primary account',
    );
    pendingSignatures = [request, ...pendingSignatures];
    await _persistSignatures();
    notifyListeners();
    return request;
  }

  Future<void> approveSignature(String requestId) async {
    await bootstrap();
    final match = pendingSignatures.where((r) => r.id == requestId);
    if (match.isEmpty) return;
    final request = match.first;
    if (request.requestHash != null) {
      if (_consumedRequestHashes.contains(request.requestHash)) {
        pendingSignatures = pendingSignatures.where((r) => r.id != requestId).toList();
        await _persistSignatures();
        notifyListeners();
        throw StateError('Signature request already consumed (replay protection)');
      }
      _consumedRequestHashes.add(request.requestHash!);
    }

    // Live WC: local sign then respond (keys never leave device / never logged).
    if (request.wcTopic != null &&
        request.wcRequestId != null &&
        walletConnect.isLiveRelay) {
      final mnemonic = await _mnemonicProvider?.call();
      if (mnemonic == null || mnemonic.isEmpty) {
        await walletConnect.respondLiveRequest(
          topic: request.wcTopic!,
          requestId: request.wcRequestId!,
          errorMessage: 'Wallet keys unavailable',
          errorCode: 5001,
        );
        throw StateError('Wallet keys unavailable for local signing.');
      }
      try {
        final String signature;
        if (request.wcMethod == 'eth_signTypedData_v4') {
          signature = _signer.signTypedDataV4(
            mnemonic: mnemonic,
            typedDataJson: request.wcRawPayload ?? '{}',
          );
        } else {
          signature = _signer.personalSign(
            mnemonic: mnemonic,
            message: request.wcRawPayload ?? request.payloadSummary,
          );
        }
        await walletConnect.respondLiveRequest(
          topic: request.wcTopic!,
          requestId: request.wcRequestId!,
          result: signature,
        );
      } catch (e) {
        await walletConnect.respondLiveRequest(
          topic: request.wcTopic!,
          requestId: request.wcRequestId!,
          errorMessage: 'Local signing failed',
          errorCode: 5001,
        );
        rethrow;
      }
    }

    pendingSignatures = pendingSignatures.where((r) => r.id != requestId).toList();
    await touchSession(request.sessionId);
    await _addActivity(
      kind: Web3ActivityKind.signature,
      title: walletConnect.isLiveRelay && request.wcTopic != null
          ? 'Signature approved (local sign)'
          : 'Signature approved',
      detail: '${request.purpose} · ${request.payloadSummary}',
      appName: request.appName,
      origin: request.origin,
      status: Web3ActivityStatus.confirmed,
    );
    await _persistSignatures();
    notifyListeners();
  }

  Future<void> rejectSignature(String requestId) async {
    await bootstrap();
    final match = pendingSignatures.where((r) => r.id == requestId);
    if (match.isEmpty) return;
    final request = match.first;
    if (request.wcTopic != null && request.wcRequestId != null) {
      try {
        await walletConnect.respondLiveRequest(
          topic: request.wcTopic!,
          requestId: request.wcRequestId!,
          errorMessage: 'User rejected method',
          errorCode: 5001,
        );
      } catch (_) {}
    }
    pendingSignatures = pendingSignatures.where((r) => r.id != requestId).toList();
    await _addActivity(
      kind: Web3ActivityKind.signature,
      title: 'Signature rejected',
      detail: request.purpose,
      appName: request.appName,
      origin: request.origin,
      status: Web3ActivityStatus.rejected,
    );
    await _persistSignatures();
    notifyListeners();
  }

  Future<DappTransactionRequest> enqueueTransactionRequest({
    required String sessionId,
    String? recipient,
    String? assetSymbol,
    double? amount,
    String? purpose,
  }) async {
    await bootstrap();
    final session = sessions.firstWhere((s) => s.id == sessionId && s.active);
    final request = DappTransactionRequest(
      id: _id('dtx'),
      sessionId: session.id,
      appName: session.label,
      origin: session.origin,
      recipient: recipient ?? '0xPreview…Recipient',
      network: session.networks.isNotEmpty ? session.networks.first : 'ETHEREUM',
      assetSymbol: assetSymbol ?? 'ETH',
      amount: amount ?? 0.01,
      feeEstimate: '~\$1.20 · ~21,000 gas units (preview estimate — not live)',
      purpose: purpose ?? 'dApp requested transfer',
      createdAt: DateTime.now(),
      risk: ConnectionRisk.elevated,
      warnings: const [
        'This can move funds or assets if approved.',
        'Preview only — approving will not broadcast as live WalletConnect.',
      ],
    );
    pendingTransactions = [request, ...pendingTransactions];
    await _persistTransactions();
    notifyListeners();
    return request;
  }

  Future<void> approveTransaction(String requestId) async {
    await bootstrap();
    final match = pendingTransactions.where((r) => r.id == requestId);
    if (match.isEmpty) return;
    final request = match.first;

    // Live WC eth_sendTransaction — parse OK, broadcast blocked by kill switch.
    if (request.wcTopic != null && request.wcRequestId != null) {
      if (!ReleaseConfig.liveBroadcastEnabled) {
        try {
          await walletConnect.respondLiveRequest(
            topic: request.wcTopic!,
            requestId: request.wcRequestId!,
            errorCode: 5001,
            errorMessage:
                'Live transaction broadcast is disabled on Auvora Wallet '
                '(kill switch). WalletConnect cannot bypass this safety gate.',
          );
        } catch (_) {}
        pendingTransactions = pendingTransactions.where((r) => r.id != requestId).toList();
        await _addActivity(
          kind: Web3ActivityKind.dappTransaction,
          title: 'dApp tx refused (broadcast off)',
          detail:
              '${request.amount} ${request.assetSymbol} → ${request.recipient}. '
              'Parsed and previewed; liveBroadcastEnabled=false.',
          appName: request.appName,
          origin: request.origin,
          status: Web3ActivityStatus.rejected,
        );
        await _persistTransactions();
        notifyListeners();
        throw const WcBroadcastDisabledException(
          'Live broadcast is disabled. Transaction was not broadcast.',
        );
      }
      // Future audited path only — still refuse until dedicated adapter ships.
      await walletConnect.respondLiveRequest(
        topic: request.wcTopic!,
        requestId: request.wcRequestId!,
        errorCode: 5001,
        errorMessage: 'Broadcast adapter not enabled',
      );
      throw const WcBroadcastDisabledException('Broadcast adapter not enabled');
    }

    pendingTransactions = pendingTransactions.where((r) => r.id != requestId).toList();
    await touchSession(request.sessionId);
    await _addActivity(
      kind: Web3ActivityKind.dappTransaction,
      title: 'dApp transaction approved (preview)',
      detail:
          '${request.amount} ${request.assetSymbol} → ${request.recipient} on ${request.network}. ${request.feeEstimate}',
      appName: request.appName,
      origin: request.origin,
      status: Web3ActivityStatus.confirmed,
    );
    await _persistTransactions();
    notifyListeners();
  }

  Future<void> rejectTransaction(String requestId) async {
    await bootstrap();
    final match = pendingTransactions.where((r) => r.id == requestId);
    if (match.isEmpty) return;
    final request = match.first;
    if (request.wcTopic != null && request.wcRequestId != null) {
      try {
        await walletConnect.respondLiveRequest(
          topic: request.wcTopic!,
          requestId: request.wcRequestId!,
          errorMessage: 'User rejected method',
          errorCode: 5001,
        );
      } catch (_) {}
    }
    pendingTransactions = pendingTransactions.where((r) => r.id != requestId).toList();
    await _addActivity(
      kind: Web3ActivityKind.dappTransaction,
      title: 'dApp transaction rejected',
      detail: '${request.amount} ${request.assetSymbol} to ${request.recipient}',
      appName: request.appName,
      origin: request.origin,
      status: Web3ActivityStatus.rejected,
    );
    await _persistTransactions();
    notifyListeners();
  }

  // --- Queries ------------------------------------------------------------

  List<ConnectedAppSession> filteredSessions({
    String query = '',
    bool activeOnly = true,
    String? network,
  }) {
    final q = query.trim().toLowerCase();
    return [
      for (final s in sessions)
        if ((!activeOnly || s.active) &&
            (network == null || s.networks.contains(network)) &&
            (q.isEmpty ||
                s.label.toLowerCase().contains(q) ||
                s.origin.toLowerCase().contains(q) ||
                s.appName.toLowerCase().contains(q)))
          s,
    ];
  }

  List<Web3ActivityEvent> filteredActivity({
    String query = '',
    Web3ActivityKind? kind,
  }) {
    final q = query.trim().toLowerCase();
    return [
      for (final e in activity)
        if ((kind == null || e.kind == kind) &&
            (q.isEmpty ||
                e.title.toLowerCase().contains(q) ||
                e.detail.toLowerCase().contains(q) ||
                (e.appName?.toLowerCase().contains(q) ?? false) ||
                (e.origin?.toLowerCase().contains(q) ?? false)))
          e,
    ];
  }

  // --- Persistence helpers ------------------------------------------------

  Future<void> _addActivity({
    required Web3ActivityKind kind,
    required String title,
    required String detail,
    required Web3ActivityStatus status,
    String? appName,
    String? origin,
  }) async {
    activity = [
      Web3ActivityEvent(
        id: _id('act'),
        kind: kind,
        title: title,
        detail: detail,
        timestamp: DateTime.now(),
        status: status,
        appName: appName,
        origin: origin,
      ),
      ...activity,
    ];
    await _persistActivity();
  }

  Future<void> _persistSessions() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kSessions, jsonEncode([for (final s in sessions) s.toJson()]));
  }

  Future<void> _persistPending() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kPending, jsonEncode([for (final r in pendingRequests) r.toJson()]));
  }

  Future<void> _persistSignatures() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kSignatures, jsonEncode([for (final r in pendingSignatures) r.toJson()]));
  }

  Future<void> _persistTransactions() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kTransactions, jsonEncode([for (final r in pendingTransactions) r.toJson()]));
  }

  Future<void> _persistActivity() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kActivity, jsonEncode([for (final e in activity) e.toJson()]));
  }

  List<T> _readList<T>(String key, T Function(Map<String, dynamic>) fromJson) {
    final raw = _prefs?.getString(key);
    if (raw == null || raw.isEmpty) return const [];
    final list = jsonDecode(raw) as List<dynamic>;
    return [
      for (final item in list) fromJson(Map<String, dynamic>.from(item as Map)),
    ];
  }

  String _id(String prefix) => '$prefix-${DateTime.now().microsecondsSinceEpoch}';

  String _normalizeOrigin(String origin) {
    try {
      final uri = Uri.parse(origin.contains('://') ? origin : 'https://$origin');
      return uri.origin.toLowerCase();
    } catch (_) {
      return origin.toLowerCase();
    }
  }

  _ParsedPair _parsePairInput(String rawInput, {required ConnectionMethod method}) {
    final raw = rawInput.trim();
    if (raw.isEmpty) {
      return const _ParsedPair(
        appName: 'Unknown app',
        origin: 'auvora://pairing/unknown',
        networks: ['ETHEREUM'],
        permissions: [
          DappPermissionCode.viewAddresses,
          DappPermissionCode.viewBalances,
          DappPermissionCode.requestSignatures,
        ],
        pairUri: null,
        syntheticOrigin: true,
        note: 'Empty pairing input — reject unless you intended this.',
      );
    }

    // wc:…@2?relay-protocol=irn&symKey=… — optionally `#https://real-dapp.example`
    if (raw.toLowerCase().startsWith('wc:')) {
      final fragmentOrigin = _wcFragmentOrigin(raw);
      if (fragmentOrigin != null) {
        final known = lookupKnownDapp(fragmentOrigin);
        final host = Uri.parse(fragmentOrigin).host;
        final name = known?.name ??
            (host.startsWith('app.') ? host.split('.').skip(1).first : host.split('.').first);
        final titled = name.isEmpty ? 'WalletConnect app' : '${name[0].toUpperCase()}${name.substring(1)}';
        return _ParsedPair(
          appName: titled,
          origin: fragmentOrigin,
          networks: const ['ETHEREUM'],
          permissions: const [
            DappPermissionCode.viewAddresses,
            DappPermissionCode.viewBalances,
            DappPermissionCode.requestSignatures,
            DappPermissionCode.requestTransactions,
            DappPermissionCode.sessionManage,
          ],
          pairUri: raw,
          syntheticOrigin: false,
          note: 'Proposer URL taken from pairing metadata (preview).',
        );
      }
      final uri = Uri.tryParse(raw);
      final relay = uri?.queryParameters['relay-protocol'] ??
          uri?.queryParameters['relay'] ??
          'preview';
      return _ParsedPair(
        appName: 'WalletConnect app (metadata pending)',
        origin: 'auvora://walletconnect/preview',
        networks: const ['ETHEREUM'],
        permissions: const [
          DappPermissionCode.viewAddresses,
          DappPermissionCode.viewBalances,
          DappPermissionCode.requestSignatures,
          DappPermissionCode.requestTransactions,
          DappPermissionCode.sessionManage,
        ],
        pairUri: raw,
        syntheticOrigin: true,
        note: 'relay=$relay · Proposer metadata unavailable until a live WalletConnect SDK is linked.',
      );
    }

    // Pairing codes like AUVORA-DESK-7F3A or mobile codes — not public HTTPS sites.
    final codeMatch = RegExp(r'^[A-Z0-9-]{6,32}$', caseSensitive: false).hasMatch(raw);
    if (codeMatch && !raw.contains('://')) {
      final desktop = method == ConnectionMethod.desktopPairing || raw.toUpperCase().contains('DESK');
      return _ParsedPair(
        appName: desktop ? 'Desktop pairing (preview)' : 'Mobile pairing (preview)',
        origin: desktop ? 'auvora://pairing/desktop' : 'auvora://pairing/mobile',
        networks: const ['ETHEREUM', 'SOLANA'],
        permissions: const [
          DappPermissionCode.viewAddresses,
          DappPermissionCode.viewBalances,
          DappPermissionCode.requestSignatures,
          DappPermissionCode.sessionManage,
        ],
        pairUri: raw.toUpperCase(),
        syntheticOrigin: true,
        note: 'Auvora preview pairing endpoint — not a public dApp website.',
      );
    }

    // HTTPS / deep-link style — only treat as HTTPS when the user supplied a scheme or host.
    final hasScheme = raw.contains('://');
    final asUri = Uri.tryParse(hasScheme ? raw : 'https://$raw');
    if (asUri != null && asUri.host.isNotEmpty) {
      final origin = hasScheme ? asUri.origin : 'https://${asUri.host}';
      final known = lookupKnownDapp(origin);
      final host = asUri.host;
      final name = known?.name ??
          (host.startsWith('app.') ? host.split('.').skip(1).first : host.split('.').first);
      final titled = name.isEmpty ? 'dApp' : '${name[0].toUpperCase()}${name.substring(1)}';
      return _ParsedPair(
        appName: titled,
        origin: origin,
        networks: const ['ETHEREUM'],
        permissions: const [
          DappPermissionCode.viewAddresses,
          DappPermissionCode.viewBalances,
          DappPermissionCode.requestSignatures,
          DappPermissionCode.requestTransactions,
          DappPermissionCode.networkSwitch,
          DappPermissionCode.sessionManage,
        ],
        pairUri: raw,
        syntheticOrigin: false,
        note: hasScheme
            ? null
            : 'Assumed https:// for host-only input (preview defaults — not proposer namespaces).',
      );
    }

    return _ParsedPair(
      appName: 'Pasted pairing',
      origin: 'auvora://pairing/raw',
      networks: const ['ETHEREUM'],
      permissions: const [
        DappPermissionCode.viewAddresses,
        DappPermissionCode.requestSignatures,
      ],
      pairUri: raw,
      syntheticOrigin: true,
      note: 'Unrecognized pairing format — review carefully before approving.',
    );
  }

  String? _wcFragmentOrigin(String raw) {
    final hash = raw.indexOf('#');
    if (hash < 0 || hash >= raw.length - 1) return null;
    final frag = Uri.decodeComponent(raw.substring(hash + 1)).trim();
    if (!frag.toLowerCase().startsWith('http://') && !frag.toLowerCase().startsWith('https://')) {
      return null;
    }
    final uri = Uri.tryParse(frag);
    if (uri == null || uri.host.isEmpty) return null;
    return uri.origin;
  }

}

class _ParsedPair {
  const _ParsedPair({
    required this.appName,
    required this.origin,
    required this.networks,
    required this.permissions,
    this.pairUri,
    this.note,
    this.syntheticOrigin = false,
  });

  final String appName;
  final String origin;
  final List<String> networks;
  final List<DappPermissionCode> permissions;
  final String? pairUri;
  final String? note;
  /// True when origin is an Auvora placeholder (not a real public dApp URL).
  final bool syntheticOrigin;
}
