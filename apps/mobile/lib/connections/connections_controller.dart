import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../security/security_models.dart';
import 'known_catalog.dart';
import 'models.dart';
import 'permission_catalog.dart';

class ConnectionsController extends ChangeNotifier {
  SharedPreferences? _prefs;
  bool loading = true;

  List<ConnectedAppSession> sessions = const [];
  List<DappConnectionRequest> pendingRequests = const [];
  List<SignatureRequest> pendingSignatures = const [];
  List<DappTransactionRequest> pendingTransactions = const [];
  List<Web3ActivityEvent> activity = const [];

  static const _kSessions = 'auvora_connections_sessions_v1';
  static const _kPending = 'auvora_connections_pending_v1';
  static const _kSignatures = 'auvora_connections_signatures_v1';
  static const _kTransactions = 'auvora_connections_transactions_v1';
  static const _kActivity = 'auvora_connections_activity_v1';

  List<ConnectedAppSession> get activeSessions =>
      sessions.where((s) => s.active).toList(growable: false);

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
    if (sessions.isEmpty && activity.isEmpty) {
      sessions = _seedSessions();
      activity = _seedActivity(sessions);
      await _persistAll();
    }
    loading = false;
    notifyListeners();
  }

  // --- Pairing / approval -------------------------------------------------

  /// Accept a WalletConnect-shaped URI, pairing code, or deep-link preview payload.
  Future<DappConnectionRequest> createPairingRequest({
    required String rawInput,
    required ConnectionMethod method,
    String? account,
  }) async {
    await bootstrap();
    final parsed = _parsePairInput(rawInput, method: method);
    final known = lookupKnownDapp(parsed.origin);
    final previously = sessions.any(
      (s) => _normalizeOrigin(s.origin) == _normalizeOrigin(parsed.origin),
    );
    final synthetic = parsed.syntheticOrigin;
    final https = !synthetic && parsed.origin.toLowerCase().startsWith('https://');
    final trust = TrustIndicators(
      verifiedDomain: !synthetic && known?.verified == true,
      https: https,
      previouslyConnected: previously,
      knownProject: !synthetic && known != null,
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
      if (!previously && known == null && !synthetic) 'Newly seen origin — review permissions carefully.',
      if (parsed.note case final note?) note,
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

  Future<ConnectedAppSession?> approveConnection(String requestId) async {
    await bootstrap();
    final index = pendingRequests.indexWhere((r) => r.id == requestId);
    if (index < 0) return null;
    final request = pendingRequests[index];
    final now = DateTime.now();
    final normalized = _normalizeOrigin(request.origin);

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
      detail: 'Preview session approved for ${session.origin}. Not a live WalletConnect relay.',
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

  /// Reconnect creates a fresh pending approval — never silently restore grants.
  Future<DappConnectionRequest> reconnectSession(String sessionId) async {
    await bootstrap();
    final match = sessions.where((s) => s.id == sessionId);
    if (match.isEmpty) {
      throw StateError('Session not found');
    }
    final session = match.first;
    return createPairingRequest(
      rawInput: session.origin,
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
    pendingSignatures = pendingSignatures.where((r) => r.id != requestId).toList();
    await touchSession(request.sessionId);
    await _addActivity(
      kind: Web3ActivityKind.signature,
      title: 'Signature approved',
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

  Future<void> _persistAll() async {
    await _persistSessions();
    await _persistPending();
    await _persistSignatures();
    await _persistTransactions();
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

  List<ConnectedAppSession> _seedSessions() {
    final now = DateTime.now();
    ConnectedAppSession build({
      required String id,
      required String name,
      required String origin,
      required List<String> networks,
      required List<DappPermissionCode> codes,
      required Duration ago,
      String? warning,
      bool verified = true,
    }) {
      final connectedAt = now.subtract(ago);
      return ConnectedAppSession(
        id: id,
        appName: name,
        origin: origin,
        networks: networks,
        accounts: const ['Primary account'],
        method: ConnectionMethod.walletConnectUri,
        connectedAt: connectedAt,
        lastUsedAt: now.subtract(Duration(hours: ago.inHours ~/ 2)),
        trust: TrustIndicators(
          verifiedDomain: verified,
          https: true,
          previouslyConnected: true,
          knownProject: lookupKnownDapp(origin) != null,
        ),
        grants: [
          for (final code in codes)
            PermissionGrant(
              id: '$id-${code.wire}',
              sessionId: id,
              code: code,
              grantedAt: connectedAt,
              lastUsedAt: now.subtract(Duration(hours: ago.inHours ~/ 3)),
            ),
        ],
        faviconHint: name.substring(0, 1),
        warning: warning,
      );
    }

    return [
      build(
        id: 'sess-uniswap',
        name: 'Uniswap',
        origin: 'https://app.uniswap.org',
        networks: const ['ETHEREUM'],
        codes: const [
          DappPermissionCode.viewAddresses,
          DappPermissionCode.viewBalances,
          DappPermissionCode.requestSignatures,
          DappPermissionCode.requestTransactions,
          DappPermissionCode.sessionManage,
        ],
        ago: const Duration(days: 4),
        warning: 'Can request transactions that move funds.',
      ),
      build(
        id: 'sess-aave',
        name: 'Aave',
        origin: 'https://app.aave.com',
        networks: const ['ETHEREUM'],
        codes: const [
          DappPermissionCode.viewAddresses,
          DappPermissionCode.viewBalances,
          DappPermissionCode.requestSignatures,
          DappPermissionCode.sessionManage,
        ],
        ago: const Duration(days: 10),
      ),
      build(
        id: 'sess-snapshot',
        name: 'Snapshot',
        origin: 'https://snapshot.org',
        networks: const ['ETHEREUM'],
        codes: const [
          DappPermissionCode.viewAddresses,
          DappPermissionCode.requestSignatures,
        ],
        ago: const Duration(days: 18),
      ),
    ];
  }

  List<Web3ActivityEvent> _seedActivity(List<ConnectedAppSession> seed) {
    final now = DateTime.now();
    return [
      for (final s in seed)
        Web3ActivityEvent(
          id: 'act-seed-${s.id}',
          kind: Web3ActivityKind.connected,
          title: 'Connected ${s.label}',
          detail: 'Preview seed session for ${s.origin}.',
          timestamp: s.connectedAt,
          status: Web3ActivityStatus.confirmed,
          appName: s.label,
          origin: s.origin,
        ),
      Web3ActivityEvent(
        id: 'act-seed-sig',
        kind: Web3ActivityKind.signature,
        title: 'Signature approved',
        detail: 'Message sign · Welcome to Uniswap',
        timestamp: now.subtract(const Duration(days: 2)),
        status: Web3ActivityStatus.confirmed,
        appName: 'Uniswap',
        origin: 'https://app.uniswap.org',
      ),
    ];
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
