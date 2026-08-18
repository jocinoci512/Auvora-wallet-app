import 'dart:convert';

import 'package:auvora_wallet/account/account_controller.dart';
import 'package:auvora_wallet/account/auth_api_client.dart';
import 'package:auvora_wallet/account/auth_token_store.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _base = 'https://api.test.local';
const _secureChannel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

/// In-memory stand-in for the flutter_secure_storage platform channel.
Map<String, String> installSecureStorageMock() {
  final data = <String, String>{};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
    _secureChannel,
    (call) async {
      final args = (call.arguments as Map?) ?? {};
      final key = args['key'] as String?;
      switch (call.method) {
        case 'write':
          data[key!] = args['value'] as String;
          return null;
        case 'read':
          return data[key];
        case 'delete':
          data.remove(key);
          return null;
        case 'readAll':
          return Map<String, String>.from(data);
        case 'deleteAll':
          data.clear();
          return null;
        case 'containsKey':
          return data.containsKey(key);
        default:
          return null;
      }
    },
  );
  return data;
}

/// A MockClient that routes by (method, path) with optional per-path sequencing.
http.Client routed(Map<String, List<http.Response>> routes) {
  final counters = <String, int>{};
  return MockClient((req) async {
    final key = '${req.method} ${req.url.path}';
    final seq = routes[key];
    if (seq == null || seq.isEmpty) {
      return http.Response('{}', 404, headers: {'content-type': 'application/json'});
    }
    final i = (counters[key] ?? 0).clamp(0, seq.length - 1);
    counters[key] = i + 1;
    return seq[i];
  });
}

http.Response ok(Map<String, dynamic> data) =>
    http.Response(jsonEncode({'success': true, 'data': data}), 200, headers: {'content-type': 'application/json'});
http.Response created(Map<String, dynamic> data) =>
    http.Response(jsonEncode({'success': true, 'data': data}), 201, headers: {'content-type': 'application/json'});
http.Response err(int status) =>
    http.Response(jsonEncode({'success': false}), status, headers: {'content-type': 'application/json'});

AccountController controllerWith(http.Client httpClient) => AccountController(
      client: AuthApiClient(httpClient: httpClient, baseUrl: _base),
      store: AuthTokenStore(),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Map<String, String> store;

  setUp(() {
    store = installSecureStorageMock();
  });

  const profile = {'id': 'u1', 'email': 'a@b.com', 'username': 'alice', 'status': 'ACTIVE', 'emailVerified': true};

  test('signIn success -> signedIn with profile and stored access token', () async {
    final c = controllerWith(
      routed({
        'POST /api/v1/auth/login': [ok({'accessToken': 'acc-1', 'refreshToken': 'ref-1', 'expiresIn': 900, 'sessionId': 's1'})],
        'GET /api/v1/me': [ok(profile)],
      }),
    );
    final okResult = await c.signIn(email: 'a@b.com', password: 'SuperSecret123');
    expect(okResult, isTrue);
    expect(c.isSignedIn, isTrue);
    expect(c.profile?.email, 'a@b.com');
    expect(store['auvora_acct_access_v1'], 'acc-1');
    expect(store['auvora_acct_refresh_v1'], 'ref-1');
  });

  test('signIn with invalid credentials -> signedOut with error', () async {
    final c = controllerWith(
      routed({'POST /api/v1/auth/login': [err(401)]}),
    );
    final result = await c.signIn(email: 'a@b.com', password: 'wrong');
    expect(result, isFalse);
    expect(c.status, AccountStatus.signedOut);
    expect(c.error, isNotNull);
  });

  test('register -> auto sign-in -> signedIn', () async {
    final c = controllerWith(
      routed({
        'POST /api/v1/auth/register': [created({'userId': 'u1'})],
        'POST /api/v1/auth/login': [ok({'accessToken': 'acc-1', 'refreshToken': 'ref-1', 'expiresIn': 900, 'sessionId': 's1'})],
        'GET /api/v1/me': [ok(profile)],
      }),
    );
    final result = await c.register(email: 'a@b.com', username: 'alice', password: 'SuperSecret123');
    expect(result, isTrue);
    expect(c.isSignedIn, isTrue);
  });

  test('signOut clears account tokens (wallet vault untouched)', () async {
    store['auvora_acct_access_v1'] = 'acc-1';
    store['auvora_acct_refresh_v1'] = 'ref-1';
    // A wallet vault key that must NOT be removed by account sign-out.
    store['auvora_mnemonic_v3_wallet-1'] = 'do-not-touch';
    final c = controllerWith(
      routed({'POST /api/v1/auth/logout': [ok({'message': 'ok'})]}),
    );
    await c.signOut();
    expect(c.status, AccountStatus.signedOut);
    expect(store.containsKey('auvora_acct_access_v1'), isFalse);
    expect(store.containsKey('auvora_acct_refresh_v1'), isFalse);
    // Wallet vault entry is preserved.
    expect(store['auvora_mnemonic_v3_wallet-1'], 'do-not-touch');
  });

  test('bootstrap restores a valid session', () async {
    store['auvora_acct_access_v1'] = 'acc-1';
    final c = controllerWith(
      routed({'GET /api/v1/me': [ok(profile)]}),
    );
    await c.bootstrap();
    expect(c.isSignedIn, isTrue);
    expect(c.profile?.username, 'alice');
  });

  test('bootstrap refreshes when the access token is expired', () async {
    store['auvora_acct_access_v1'] = 'stale';
    store['auvora_acct_refresh_v1'] = 'ref-1';
    final c = controllerWith(
      routed({
        // First /me (with stale token) 401, then after refresh 200.
        'GET /api/v1/me': [err(401), ok(profile)],
        'POST /api/v1/auth/refresh': [ok({'accessToken': 'acc-2', 'refreshToken': 'ref-2', 'expiresIn': 900, 'sessionId': 's1'})],
      }),
    );
    await c.bootstrap();
    expect(c.isSignedIn, isTrue);
    expect(store['auvora_acct_access_v1'], 'acc-2');
  });

  test('bootstrap with no token -> signedOut', () async {
    final c = controllerWith(routed({}));
    await c.bootstrap();
    expect(c.status, AccountStatus.signedOut);
  });

  test('bootstrap network failure keeps tokens and cached identity', () async {
    store['auvora_acct_access_v1'] = 'acc-1';
    store['auvora_acct_refresh_v1'] = 'ref-1';
    store['auvora_acct_uid_v1'] = 'u1';
    store['auvora_acct_email_v1'] = 'a@b.com';
    store['auvora_acct_username_v1'] = 'alice';
    final mock = MockClient((req) async => throw http.ClientException('offline'));
    final c = controllerWith(mock);
    await c.bootstrap();
    expect(c.isSignedIn, isTrue);
    expect(c.profile?.email, 'a@b.com');
    expect(store['auvora_acct_access_v1'], 'acc-1');
    expect(store['auvora_acct_refresh_v1'], 'ref-1');
    expect(c.error, contains('internet'));
  });

  test('bootstrap invalid refresh signs out (no login loop)', () async {
    store['auvora_acct_access_v1'] = 'stale';
    store['auvora_acct_refresh_v1'] = 'revoked';
    final c = controllerWith(
      routed({
        'GET /api/v1/me': [err(401)],
        'POST /api/v1/auth/refresh': [err(401)],
      }),
    );
    await c.bootstrap();
    expect(c.status, AccountStatus.signedOut);
    expect(store.containsKey('auvora_acct_access_v1'), isFalse);
  });

  test('revalidate recovers after a transient failure', () async {
    store['auvora_acct_access_v1'] = 'acc-1';
    store['auvora_acct_uid_v1'] = 'u1';
    store['auvora_acct_email_v1'] = 'a@b.com';
    store['auvora_acct_username_v1'] = 'alice';
    var calls = 0;
    final mock = MockClient((req) async {
      calls += 1;
      if (calls == 1) throw http.ClientException('offline');
      return ok(profile);
    });
    final c = controllerWith(mock);
    await c.bootstrap();
    expect(c.isSignedIn, isTrue);
    expect(c.error, isNotNull);
    await c.revalidate();
    expect(c.isSignedIn, isTrue);
    expect(c.error, isNull);
    expect(c.profile?.username, 'alice');
  });
}
