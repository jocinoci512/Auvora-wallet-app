import 'package:flutter/foundation.dart';

enum ConnectionMethod {
  walletConnectUri,
  qr,
  deepLink,
  desktopPairing,
  mobilePairing,
}

extension ConnectionMethodLabel on ConnectionMethod {
  String get label => switch (this) {
        ConnectionMethod.walletConnectUri => 'WalletConnect URI',
        ConnectionMethod.qr => 'QR code',
        ConnectionMethod.deepLink => 'Deep link',
        ConnectionMethod.desktopPairing => 'Desktop pairing',
        ConnectionMethod.mobilePairing => 'Mobile pairing',
      };
}

enum DappPermissionCode {
  viewAddresses,
  viewBalances,
  requestSignatures,
  requestTransactions,
  networkSwitch,
  sessionManage,
}

extension DappPermissionCodeWire on DappPermissionCode {
  String get wire => switch (this) {
        DappPermissionCode.viewAddresses => 'VIEW_ADDRESSES',
        DappPermissionCode.viewBalances => 'VIEW_BALANCES',
        DappPermissionCode.requestSignatures => 'REQUEST_SIGNATURES',
        DappPermissionCode.requestTransactions => 'REQUEST_TRANSACTIONS',
        DappPermissionCode.networkSwitch => 'NETWORK_SWITCH',
        DappPermissionCode.sessionManage => 'SESSION_MANAGE',
      };

  static DappPermissionCode? tryParse(String raw) {
    for (final code in DappPermissionCode.values) {
      if (code.wire == raw || code.name == raw) return code;
    }
    return null;
  }
}

enum ConnectionRisk { low, medium, elevated }

enum ConnectionRequestStatus { pending, approved, rejected }

enum Web3ActivityKind {
  connected,
  disconnected,
  approved,
  rejected,
  signature,
  dappTransaction,
  permissionRevoked,
  renamed,
}

enum Web3ActivityStatus { confirmed, pending, rejected }

enum SignatureKind { message, typedData }

@immutable
class PermissionInfo {
  const PermissionInfo({
    required this.code,
    required this.title,
    required this.explanation,
    required this.risk,
    required this.canMoveFunds,
  });

  final DappPermissionCode code;
  final String title;
  final String explanation;
  final ConnectionRisk risk;
  final bool canMoveFunds;
}

@immutable
class TrustIndicators {
  const TrustIndicators({
    this.verifiedDomain = false,
    this.https = false,
    this.previouslyConnected = false,
    this.knownProject = false,
  });

  final bool verifiedDomain;
  final bool https;
  final bool previouslyConnected;
  final bool knownProject;

  bool get anyVerified => verifiedDomain || knownProject;

  List<String> get chips {
    final out = <String>[];
    // Catalog badges are not domain attestations — never say “Verified domain” here.
    if (verifiedDomain || knownProject) out.add('In Auvora catalog (not attestation)');
    if (https) out.add('HTTPS');
    if (previouslyConnected) out.add('Previously connected');
    return out;
  }

  String get unverifiedCopy =>
      anyVerified || https ? '' : 'We can’t verify this site yet.';

  TrustIndicators copyWithPreviouslyConnected(bool value) {
    return TrustIndicators(
      verifiedDomain: verifiedDomain,
      https: https,
      previouslyConnected: value,
      knownProject: knownProject,
    );
  }

  Map<String, dynamic> toJson() => {
        'verifiedDomain': verifiedDomain,
        'https': https,
        'previouslyConnected': previouslyConnected,
        'knownProject': knownProject,
      };

  factory TrustIndicators.fromJson(Map<String, dynamic> json) => TrustIndicators(
        verifiedDomain: json['verifiedDomain'] == true,
        https: json['https'] == true,
        previouslyConnected: json['previouslyConnected'] == true,
        knownProject: json['knownProject'] == true,
      );
}

@immutable
class DappConnectionRequest {
  const DappConnectionRequest({
    required this.id,
    required this.appName,
    required this.origin,
    required this.networks,
    required this.account,
    required this.permissions,
    required this.method,
    required this.createdAt,
    required this.status,
    required this.trust,
    this.faviconHint,
    this.pairUri,
    this.riskWarnings = const [],
  });

  final String id;
  final String appName;
  final String origin;
  final List<String> networks;
  final String account;
  final List<DappPermissionCode> permissions;
  final ConnectionMethod method;
  final DateTime createdAt;
  final ConnectionRequestStatus status;
  final TrustIndicators trust;
  final String? faviconHint;
  final String? pairUri;
  final List<String> riskWarnings;

  DappConnectionRequest copyWith({
    ConnectionRequestStatus? status,
    TrustIndicators? trust,
    List<String>? riskWarnings,
  }) {
    return DappConnectionRequest(
      id: id,
      appName: appName,
      origin: origin,
      networks: networks,
      account: account,
      permissions: permissions,
      method: method,
      createdAt: createdAt,
      status: status ?? this.status,
      trust: trust ?? this.trust,
      faviconHint: faviconHint,
      pairUri: pairUri,
      riskWarnings: riskWarnings ?? this.riskWarnings,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'appName': appName,
        'origin': origin,
        'networks': networks,
        'account': account,
        'permissions': [for (final p in permissions) p.wire],
        'method': method.name,
        'createdAt': createdAt.toIso8601String(),
        'status': status.name,
        'trust': trust.toJson(),
        'faviconHint': faviconHint,
        'pairUri': pairUri,
        'riskWarnings': riskWarnings,
      };

  factory DappConnectionRequest.fromJson(Map<String, dynamic> json) {
    return DappConnectionRequest(
      id: json['id'] as String,
      appName: json['appName'] as String,
      origin: json['origin'] as String,
      networks: (json['networks'] as List<dynamic>).cast<String>(),
      account: json['account'] as String,
      permissions: [
        for (final raw in (json['permissions'] as List<dynamic>).cast<String>())
          DappPermissionCodeWire.tryParse(raw) ?? DappPermissionCode.viewAddresses,
      ],
      method: ConnectionMethod.values.firstWhere(
        (m) => m.name == json['method'],
        orElse: () => ConnectionMethod.walletConnectUri,
      ),
      createdAt: DateTime.parse(json['createdAt'] as String),
      status: ConnectionRequestStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => ConnectionRequestStatus.pending,
      ),
      trust: TrustIndicators.fromJson(Map<String, dynamic>.from(json['trust'] as Map? ?? const {})),
      faviconHint: json['faviconHint'] as String?,
      pairUri: json['pairUri'] as String?,
      riskWarnings: (json['riskWarnings'] as List<dynamic>?)?.cast<String>() ?? const [],
    );
  }
}

@immutable
class PermissionGrant {
  const PermissionGrant({
    required this.id,
    required this.sessionId,
    required this.code,
    required this.grantedAt,
    this.lastUsedAt,
    this.revoked = false,
  });

  final String id;
  final String sessionId;
  final DappPermissionCode code;
  final DateTime grantedAt;
  final DateTime? lastUsedAt;
  final bool revoked;

  PermissionGrant copyWith({DateTime? lastUsedAt, bool? revoked}) {
    return PermissionGrant(
      id: id,
      sessionId: sessionId,
      code: code,
      grantedAt: grantedAt,
      lastUsedAt: lastUsedAt ?? this.lastUsedAt,
      revoked: revoked ?? this.revoked,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'sessionId': sessionId,
        'code': code.wire,
        'grantedAt': grantedAt.toIso8601String(),
        'lastUsedAt': lastUsedAt?.toIso8601String(),
        'revoked': revoked,
      };

  factory PermissionGrant.fromJson(Map<String, dynamic> json) {
    return PermissionGrant(
      id: json['id'] as String,
      sessionId: json['sessionId'] as String,
      code: DappPermissionCodeWire.tryParse(json['code'] as String) ?? DappPermissionCode.viewAddresses,
      grantedAt: DateTime.parse(json['grantedAt'] as String),
      lastUsedAt: DateTime.tryParse((json['lastUsedAt'] as String?) ?? ''),
      revoked: json['revoked'] == true,
    );
  }
}

@immutable
class ConnectedAppSession {
  const ConnectedAppSession({
    required this.id,
    required this.appName,
    required this.origin,
    required this.networks,
    required this.accounts,
    required this.method,
    required this.connectedAt,
    required this.lastUsedAt,
    required this.trust,
    required this.grants,
    this.displayName,
    this.faviconHint,
    this.warning,
    this.active = true,
  });

  final String id;
  final String appName;
  final String origin;
  final List<String> networks;
  final List<String> accounts;
  final ConnectionMethod method;
  final DateTime connectedAt;
  final DateTime lastUsedAt;
  final TrustIndicators trust;
  final List<PermissionGrant> grants;
  final String? displayName;
  final String? faviconHint;
  final String? warning;
  final bool active;

  String get label => (displayName?.trim().isNotEmpty == true) ? displayName!.trim() : appName;

  List<DappPermissionCode> get activePermissionCodes => [
        for (final g in grants)
          if (!g.revoked) g.code,
      ];

  ConnectedAppSession copyWith({
    String? displayName,
    DateTime? lastUsedAt,
    TrustIndicators? trust,
    List<PermissionGrant>? grants,
    String? warning,
    bool? active,
    List<String>? networks,
    List<String>? accounts,
  }) {
    return ConnectedAppSession(
      id: id,
      appName: appName,
      origin: origin,
      networks: networks ?? this.networks,
      accounts: accounts ?? this.accounts,
      method: method,
      connectedAt: connectedAt,
      lastUsedAt: lastUsedAt ?? this.lastUsedAt,
      trust: trust ?? this.trust,
      grants: grants ?? this.grants,
      displayName: displayName ?? this.displayName,
      faviconHint: faviconHint,
      warning: warning ?? this.warning,
      active: active ?? this.active,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'appName': appName,
        'origin': origin,
        'networks': networks,
        'accounts': accounts,
        'method': method.name,
        'connectedAt': connectedAt.toIso8601String(),
        'lastUsedAt': lastUsedAt.toIso8601String(),
        'trust': trust.toJson(),
        'grants': [for (final g in grants) g.toJson()],
        'displayName': displayName,
        'faviconHint': faviconHint,
        'warning': warning,
        'active': active,
      };

  factory ConnectedAppSession.fromJson(Map<String, dynamic> json) {
    return ConnectedAppSession(
      id: json['id'] as String,
      appName: json['appName'] as String,
      origin: json['origin'] as String,
      networks: (json['networks'] as List<dynamic>).cast<String>(),
      accounts: (json['accounts'] as List<dynamic>).cast<String>(),
      method: ConnectionMethod.values.firstWhere(
        (m) => m.name == json['method'],
        orElse: () => ConnectionMethod.walletConnectUri,
      ),
      connectedAt: DateTime.parse(json['connectedAt'] as String),
      lastUsedAt: DateTime.parse(json['lastUsedAt'] as String),
      trust: TrustIndicators.fromJson(Map<String, dynamic>.from(json['trust'] as Map? ?? const {})),
      grants: [
        for (final item in (json['grants'] as List<dynamic>? ?? const []))
          PermissionGrant.fromJson(Map<String, dynamic>.from(item as Map)),
      ],
      displayName: json['displayName'] as String?,
      faviconHint: json['faviconHint'] as String?,
      warning: json['warning'] as String?,
      active: json['active'] != false,
    );
  }
}

@immutable
class SignatureRequest {
  const SignatureRequest({
    required this.id,
    required this.sessionId,
    required this.appName,
    required this.origin,
    required this.kind,
    required this.purpose,
    required this.payloadSummary,
    required this.network,
    required this.createdAt,
    required this.risk,
    required this.canMoveFunds,
    this.status = ConnectionRequestStatus.pending,
  });

  final String id;
  final String sessionId;
  final String appName;
  final String origin;
  final SignatureKind kind;
  final String purpose;
  final String payloadSummary;
  final String network;
  final DateTime createdAt;
  final ConnectionRisk risk;
  final bool canMoveFunds;
  final ConnectionRequestStatus status;

  SignatureRequest copyWith({ConnectionRequestStatus? status}) {
    return SignatureRequest(
      id: id,
      sessionId: sessionId,
      appName: appName,
      origin: origin,
      kind: kind,
      purpose: purpose,
      payloadSummary: payloadSummary,
      network: network,
      createdAt: createdAt,
      risk: risk,
      canMoveFunds: canMoveFunds,
      status: status ?? this.status,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'sessionId': sessionId,
        'appName': appName,
        'origin': origin,
        'kind': kind.name,
        'purpose': purpose,
        'payloadSummary': payloadSummary,
        'network': network,
        'createdAt': createdAt.toIso8601String(),
        'risk': risk.name,
        'canMoveFunds': canMoveFunds,
        'status': status.name,
      };

  factory SignatureRequest.fromJson(Map<String, dynamic> json) {
    return SignatureRequest(
      id: json['id'] as String,
      sessionId: json['sessionId'] as String,
      appName: json['appName'] as String,
      origin: json['origin'] as String,
      kind: SignatureKind.values.firstWhere(
        (k) => k.name == json['kind'],
        orElse: () => SignatureKind.message,
      ),
      purpose: json['purpose'] as String,
      payloadSummary: json['payloadSummary'] as String,
      network: json['network'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      risk: ConnectionRisk.values.firstWhere(
        (r) => r.name == json['risk'],
        orElse: () => ConnectionRisk.medium,
      ),
      canMoveFunds: json['canMoveFunds'] == true,
      status: ConnectionRequestStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => ConnectionRequestStatus.pending,
      ),
    );
  }
}

@immutable
class DappTransactionRequest {
  const DappTransactionRequest({
    required this.id,
    required this.sessionId,
    required this.appName,
    required this.origin,
    required this.recipient,
    required this.network,
    required this.assetSymbol,
    required this.amount,
    required this.feeEstimate,
    required this.purpose,
    required this.createdAt,
    required this.risk,
    this.simulationNote =
        'Preview simulation — not live chain state. Fee and outcome estimates are illustrative only.',
    this.status = ConnectionRequestStatus.pending,
    this.warnings = const [],
  });

  final String id;
  final String sessionId;
  final String appName;
  final String origin;
  final String recipient;
  final String network;
  final String assetSymbol;
  final double amount;
  final String feeEstimate;
  final String purpose;
  final DateTime createdAt;
  final ConnectionRisk risk;
  final String simulationNote;
  final ConnectionRequestStatus status;
  final List<String> warnings;

  DappTransactionRequest copyWith({ConnectionRequestStatus? status}) {
    return DappTransactionRequest(
      id: id,
      sessionId: sessionId,
      appName: appName,
      origin: origin,
      recipient: recipient,
      network: network,
      assetSymbol: assetSymbol,
      amount: amount,
      feeEstimate: feeEstimate,
      purpose: purpose,
      createdAt: createdAt,
      risk: risk,
      simulationNote: simulationNote,
      status: status ?? this.status,
      warnings: warnings,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'sessionId': sessionId,
        'appName': appName,
        'origin': origin,
        'recipient': recipient,
        'network': network,
        'assetSymbol': assetSymbol,
        'amount': amount,
        'feeEstimate': feeEstimate,
        'purpose': purpose,
        'createdAt': createdAt.toIso8601String(),
        'risk': risk.name,
        'simulationNote': simulationNote,
        'status': status.name,
        'warnings': warnings,
      };

  factory DappTransactionRequest.fromJson(Map<String, dynamic> json) {
    return DappTransactionRequest(
      id: json['id'] as String,
      sessionId: json['sessionId'] as String,
      appName: json['appName'] as String,
      origin: json['origin'] as String,
      recipient: json['recipient'] as String,
      network: json['network'] as String,
      assetSymbol: json['assetSymbol'] as String,
      amount: (json['amount'] as num).toDouble(),
      feeEstimate: json['feeEstimate'] as String,
      purpose: json['purpose'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      risk: ConnectionRisk.values.firstWhere(
        (r) => r.name == json['risk'],
        orElse: () => ConnectionRisk.elevated,
      ),
      simulationNote: (json['simulationNote'] as String?) ??
          'Preview simulation — not live chain state. Fee and outcome estimates are illustrative only.',
      status: ConnectionRequestStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => ConnectionRequestStatus.pending,
      ),
      warnings: (json['warnings'] as List<dynamic>?)?.cast<String>() ?? const [],
    );
  }
}

@immutable
class Web3ActivityEvent {
  const Web3ActivityEvent({
    required this.id,
    required this.kind,
    required this.title,
    required this.detail,
    required this.timestamp,
    required this.status,
    this.appName,
    this.origin,
  });

  final String id;
  final Web3ActivityKind kind;
  final String title;
  final String detail;
  final DateTime timestamp;
  final Web3ActivityStatus status;
  final String? appName;
  final String? origin;

  Map<String, dynamic> toJson() => {
        'id': id,
        'kind': kind.name,
        'title': title,
        'detail': detail,
        'timestamp': timestamp.toIso8601String(),
        'status': status.name,
        'appName': appName,
        'origin': origin,
      };

  factory Web3ActivityEvent.fromJson(Map<String, dynamic> json) {
    return Web3ActivityEvent(
      id: json['id'] as String,
      kind: Web3ActivityKind.values.firstWhere(
        (k) => k.name == json['kind'],
        orElse: () => Web3ActivityKind.connected,
      ),
      title: json['title'] as String,
      detail: json['detail'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      status: Web3ActivityStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => Web3ActivityStatus.confirmed,
      ),
      appName: json['appName'] as String?,
      origin: json['origin'] as String?,
    );
  }
}
