import 'package:auvora_wallet/connections/connections_controller.dart';
import 'package:auvora_wallet/connections/known_catalog.dart';
import 'package:auvora_wallet/connections/models.dart';
import 'package:auvora_wallet/connections/permission_catalog.dart';
import 'package:auvora_wallet/connections/wallet_connect_provider.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<ConnectedAppSession> _approveUniswap(ConnectionsController c) async {
  final request = await c.createPairingRequest(
    rawInput: 'wc:preview@2?relay-protocol=irn&symKey=demo#https://app.uniswap.org',
    method: ConnectionMethod.walletConnectUri,
  );
  final session = await c.approveConnection(request.id);
  expect(session, isNotNull);
  return session!;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('permission catalog', () {
    test('maps codes to plain-language titles and risk', () {
      final view = permissionInfoFor(DappPermissionCode.viewAddresses);
      expect(view.title.toLowerCase(), contains('address'));
      expect(view.canMoveFunds, isFalse);
      expect(view.risk, ConnectionRisk.low);

      final tx = permissionInfoFor(DappPermissionCode.requestTransactions);
      expect(tx.canMoveFunds, isTrue);
      expect(tx.risk, ConnectionRisk.elevated);
      expect(tx.explanation.toLowerCase(), contains('approve'));
    });

    test('highestRisk prefers elevated transaction grants', () {
      expect(
        highestRisk([
          DappPermissionCode.viewBalances,
          DappPermissionCode.requestTransactions,
        ]),
        ConnectionRisk.elevated,
      );
    });
  });

  group('ConnectionsController', () {
    test('boots empty without invented sessions or activity', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      expect(c.loading, isFalse);
      expect(c.activeSessions, isEmpty);
      expect(c.activity, isEmpty);
      expect(c.connectedDappsSummary, isEmpty);
    });

    test('approve and reject connection reducers', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      final before = c.activeSessions.length;

      final request = await c.createPairingRequest(
        rawInput: 'wc:preview@2?relay-protocol=irn&symKey=demo#https://app.uniswap.org',
        method: ConnectionMethod.walletConnectUri,
      );
      expect(c.pendingRequests.any((r) => r.id == request.id), isTrue);
      expect(request.trust.https || request.origin.startsWith('https'), isTrue);

      final session = await c.approveConnection(request.id);
      expect(session, isNotNull);
      expect(c.activeSessions.length, greaterThanOrEqualTo(before));
      expect(c.pendingRequests.any((r) => r.id == request.id), isFalse);
      expect(
        c.activity.any((e) => e.kind == Web3ActivityKind.connected && e.appName == session!.appName),
        isTrue,
      );

      final rejected = await c.createPairingRequest(
        rawInput: 'PAIR-DEMO-REJECT',
        method: ConnectionMethod.desktopPairing,
      );
      await c.rejectConnection(rejected.id);
      expect(c.pendingRequests.any((r) => r.id == rejected.id), isFalse);
      expect(
        c.activity.any((e) => e.status == Web3ActivityStatus.rejected),
        isTrue,
      );
    });

    test('revoke permission and disconnect session', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      final session = await _approveUniswap(c);
      final grant = session.grants.first;
      final grantCount = session.grants.length;

      await c.revokePermission(sessionId: session.id, grantId: grant.id);
      final refreshed = c.sessions.firstWhere((s) => s.id == session.id);
      expect(refreshed.grants.firstWhere((g) => g.id == grant.id).revoked, isTrue);
      expect(refreshed.activePermissionCodes.length, lessThan(grantCount));

      await c.disconnectSession(session.id);
      expect(c.activeSessions.any((s) => s.id == session.id), isFalse);
      expect(
        c.activity.any((e) => e.kind == Web3ActivityKind.disconnected),
        isTrue,
      );
    });

    test('activity filtering by query and kind', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      await _approveUniswap(c);
      final filtered = c.filteredActivity(query: 'uniswap');
      expect(filtered, isNotEmpty);
      expect(
        filtered.every(
          (e) =>
              (e.appName ?? '').toLowerCase().contains('uniswap') ||
              (e.origin ?? '').toLowerCase().contains('uniswap') ||
              e.title.toLowerCase().contains('uniswap') ||
              e.detail.toLowerCase().contains('uniswap'),
        ),
        isTrue,
      );

      final sig = await c.enqueueSignatureRequest(sessionId: c.activeSessions.first.id);
      await c.approveSignature(sig.id);
      final sigOnly = c.filteredActivity(kind: Web3ActivityKind.signature);
      expect(sigOnly, isNotEmpty);
      expect(sigOnly.every((e) => e.kind == Web3ActivityKind.signature), isTrue);
    });

    test('risk heuristics flag unknown and lookalike origins', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      final unknown = await c.createPairingRequest(
        rawInput: 'https://totally-unknown-dapp.example',
        method: ConnectionMethod.deepLink,
      );
      expect(
        unknown.riskWarnings.any((w) => w.toLowerCase().contains('verify') || w.toLowerCase().contains('newly')),
        isTrue,
      );

      final phishing = await c.createPairingRequest(
        rawInput: 'https://unlswap.org',
        method: ConnectionMethod.deepLink,
      );
      expect(
        phishing.riskWarnings.any((w) => w.toLowerCase().contains('similar')),
        isTrue,
      );
      expect(lookalikeHint('https://unlswap.org'), isNotNull);
      expect(lookupKnownDapp('https://app.uniswap.org'), isNotNull);
    });

    test('wc URI without metadata uses synthetic origin without HTTPS trust', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      final req = await c.createPairingRequest(
        rawInput: 'wc:topic@2?relay-protocol=irn',
        method: ConnectionMethod.walletConnectUri,
      );
      expect(req.trust.https, isFalse);
      expect(req.origin.startsWith('auvora://'), isTrue);
      expect(req.riskWarnings.any((w) => w.toLowerCase().contains('metadata')), isTrue);

      final withMeta = await c.createPairingRequest(
        rawInput: 'wc:uniswap@2?relay=preview#https://app.uniswap.org',
        method: ConnectionMethod.walletConnectUri,
      );
      expect(withMeta.origin, 'https://app.uniswap.org');
      expect(withMeta.trust.https, isTrue);
    });

    test('typed-data signatures mark spending risk', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      final session = await _approveUniswap(c);
      final sig = await c.enqueueSignatureRequest(
        sessionId: session.id,
        kind: SignatureKind.typedData,
      );
      expect(sig.canMoveFunds, isTrue);
      expect(sig.risk, ConnectionRisk.elevated);
    });

    test('approve upserts sessions by origin', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      final first = await c.createPairingRequest(
        rawInput: 'https://app.uniswap.org',
        method: ConnectionMethod.deepLink,
      );
      await c.approveConnection(first.id);
      final countAfterFirst =
          c.activeSessions.where((s) => s.origin.contains('uniswap')).length;
      final second = await c.createPairingRequest(
        rawInput: 'https://app.uniswap.org',
        method: ConnectionMethod.deepLink,
      );
      await c.approveConnection(second.id);
      final countAfterSecond =
          c.activeSessions.where((s) => s.origin.contains('uniswap')).length;
      expect(countAfterSecond, countAfterFirst);
    });

    test('signature and transaction approve record activity', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      final session = await _approveUniswap(c);

      final sig = await c.enqueueSignatureRequest(sessionId: session.id);
      await c.approveSignature(sig.id);
      expect(c.pendingSignatures.any((r) => r.id == sig.id), isFalse);
      expect(c.activity.any((e) => e.kind == Web3ActivityKind.signature), isTrue);

      final tx = await c.enqueueTransactionRequest(sessionId: session.id);
      expect(tx.simulationNote.toLowerCase(), contains('preview'));
      await c.approveTransaction(tx.id);
      expect(c.pendingTransactions.any((r) => r.id == tx.id), isFalse);
      expect(c.activity.any((e) => e.kind == Web3ActivityKind.dappTransaction), isTrue);
    });

    test('session expiry, restore, and disconnect all', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      final session = await _approveUniswap(c);
      expect(session.expiresAt, isNotNull);
      expect(session.protocolVersion, '2');

      final restored = await c.restoreSession(session.id);
      expect(restored?.active, isTrue);
      expect(c.activity.any((e) => e.kind == Web3ActivityKind.sessionRestored), isTrue);

      // Force expiry
      c.sessions = [
        for (final s in c.sessions)
          if (s.id == session.id)
            s.copyWith(expiresAt: DateTime.now().subtract(const Duration(hours: 1)))
          else
            s,
      ];
      final expiredCount = await c.expireStaleSessions(recordActivity: true);
      expect(expiredCount, 1);
      expect(c.activeSessions, isEmpty);
      expect(c.activity.any((e) => e.kind == Web3ActivityKind.sessionExpired), isTrue);

      final again = await _approveUniswap(c);
      expect(await c.disconnectAllSessions(), 1);
      expect(c.activeSessions, isEmpty);
      expect(again.id, isNotEmpty);
    });

    test('deep link validation and inbound handling', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      final provider = c.walletConnect;
      expect(provider.isLiveRelay, isFalse);
      expect(provider.projectId, isA<String>());

      final bad = provider.validateInboundUri('auvora://unknown/path');
      expect(bad.valid, isFalse);

      final wc = provider.validateInboundUri(
        'wc:preview@2?relay-protocol=irn&symKey=demo#https://app.uniswap.org',
      );
      expect(wc.valid, isTrue);

      final nested = provider.validateInboundUri(
        'auvora://wc?uri=${Uri.encodeComponent('wc:topic@2?relay-protocol=irn')}',
      );
      expect(nested.valid, isTrue);
      expect(nested.kind, DeepLinkKind.auvoraWc);

      final request = await c.handleInboundDeepLink(
        'auvora://wc?uri=${Uri.encodeComponent('wc:uni@2?relay=preview#https://app.uniswap.org')}',
      );
      expect(request, isNotNull);
      expect(c.activity.any((e) => e.kind == Web3ActivityKind.deepLink), isTrue);

      expect(
        () => c.createPairingRequest(rawInput: 'wc:', method: ConnectionMethod.walletConnectUri),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('invalid QR / incomplete wc URI is rejected', () async {
      final c = ConnectionsController();
      await c.bootstrap();
      expect(
        () => c.createPairingRequest(
          rawInput: 'wc:bad',
          method: ConnectionMethod.qr,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
