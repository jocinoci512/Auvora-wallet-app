import 'dart:convert';

import 'package:auvora_wallet/account/auth_api_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _base = 'https://api.test.local';

AuthApiClient clientReturning(
  int status,
  Object body, {
  void Function(http.Request req)? capture,
}) {
  final mock = MockClient((req) async {
    capture?.call(req);
    return http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});
  });
  return AuthApiClient(httpClient: mock, baseUrl: _base);
}

void main() {
  group('AuthApiClient', () {
    test('register returns the new user id', () async {
      final client = clientReturning(201, {
        'success': true,
        'data': {'userId': 'user-123', 'message': 'ok'},
      });
      final id = await client.register(
        email: 'a@b.com',
        username: 'alice',
        password: 'SuperSecret123',
      );
      expect(id, 'user-123');
    });

    test('login sends devicePlatform=android, no wallet secrets, and parses the session', () async {
      http.Request? sent;
      final client = clientReturning(
        200,
        {
          'success': true,
          'data': {
            'accessToken': 'access-1',
            'refreshToken': 'refresh-1',
            'expiresIn': 900,
            'sessionId': 'sess-1',
            'tokenType': 'Bearer',
          },
        },
        capture: (r) => sent = r,
      );
      final session = await client.login(
        email: 'a@b.com',
        password: 'SuperSecret123',
        deviceFingerprint: 'and-fp-12345678',
      );
      expect(session.accessToken, 'access-1');
      expect(session.refreshToken, 'refresh-1');
      expect(session.sessionId, 'sess-1');
      expect(session.expiresIn, 900);

      final body = jsonDecode(sent!.body) as Map<String, dynamic>;
      expect(body['devicePlatform'], 'android');
      expect(body['deviceFingerprint'], 'and-fp-12345678');
      // Never sends wallet secrets.
      for (final k in ['mnemonic', 'seedPhrase', 'privateKey', 'seed', 'vault']) {
        expect(body.containsKey(k), isFalse);
      }
      expect(sent!.url.path, '/api/v1/auth/login');
    });

    test('maps 401 to invalidCredentials without leaking server text', () async {
      final client = clientReturning(401, {'error': {'message': 'stack trace secret'}});
      expect(
        () => client.login(email: 'a@b.com', password: 'x', deviceFingerprint: 'and-fp-12345678'),
        throwsA(isA<AuthException>()
            .having((e) => e.kind, 'kind', AuthErrorKind.invalidCredentials)
            .having((e) => e.message, 'message', isNot(contains('stack trace')))),
      );
    });

    test('maps 403 to forbidden', () async {
      final client = clientReturning(403, {});
      expect(
        () => client.login(email: 'a@b.com', password: 'x', deviceFingerprint: 'and-fp-12345678'),
        throwsA(isA<AuthException>().having((e) => e.kind, 'kind', AuthErrorKind.forbidden)),
      );
    });

    test('maps 429 to rateLimited', () async {
      final client = clientReturning(429, {});
      expect(
        () => client.login(email: 'a@b.com', password: 'x', deviceFingerprint: 'and-fp-12345678'),
        throwsA(isA<AuthException>().having((e) => e.kind, 'kind', AuthErrorKind.rateLimited)),
      );
    });

    test('maps 404 to unknown without leaking server text', () async {
      final client = clientReturning(404, {'error': {'message': 'stack'}});
      expect(
        () => client.login(email: 'a@b.com', password: 'x', deviceFingerprint: 'and-fp-12345678'),
        throwsA(isA<AuthException>().having((e) => e.kind, 'kind', AuthErrorKind.unknown)),
      );
    });

    test('maps 502 and 503 to server error', () async {
      for (final status in [502, 503, 504]) {
        final client = clientReturning(status, {});
        expect(
          () => client.login(email: 'a@b.com', password: 'x', deviceFingerprint: 'and-fp-12345678'),
          throwsA(isA<AuthException>().having((e) => e.kind, 'kind', AuthErrorKind.server)),
        );
      }
    });

    test('maps transport failure to a network error', () async {
      final mock = MockClient((req) async => throw http.ClientException('boom'));
      final client = AuthApiClient(httpClient: mock, baseUrl: _base);
      expect(
        () => client.login(email: 'a@b.com', password: 'x', deviceFingerprint: 'and-fp-12345678'),
        throwsA(isA<AuthException>().having((e) => e.kind, 'kind', AuthErrorKind.network)),
      );
    });

    test('unconfigured base URL throws notConfigured', () async {
      final client = AuthApiClient(httpClient: MockClient((_) async => http.Response('{}', 200)), baseUrl: '');
      expect(client.isConfigured, isFalse);
      expect(
        () => client.login(email: 'a@b.com', password: 'x', deviceFingerprint: 'and-fp-12345678'),
        throwsA(isA<AuthException>().having((e) => e.kind, 'kind', AuthErrorKind.notConfigured)),
      );
    });

    test('currentUser parses safe profile fields and sends bearer token', () async {
      http.Request? sent;
      final client = clientReturning(
        200,
        {'success': true, 'data': {'id': 'u1', 'email': 'a@b.com', 'username': 'alice', 'status': 'ACTIVE', 'emailVerified': true}},
        capture: (r) => sent = r,
      );
      final profile = await client.currentUser('access-1');
      expect(profile.id, 'u1');
      expect(profile.username, 'alice');
      expect(profile.emailVerified, isTrue);
      expect(sent!.headers['authorization'], 'Bearer access-1');
      expect(sent!.url.path, '/api/v1/me');
    });

    test('refresh sends refreshToken in body and parses rotated tokens', () async {
      http.Request? sent;
      final client = clientReturning(
        200,
        {'success': true, 'data': {'accessToken': 'access-2', 'refreshToken': 'refresh-2', 'expiresIn': 900, 'sessionId': 'sess-1'}},
        capture: (r) => sent = r,
      );
      final session = await client.refresh('refresh-1');
      expect(session.accessToken, 'access-2');
      expect(session.refreshToken, 'refresh-2');
      expect((jsonDecode(sent!.body) as Map<String, dynamic>)['refreshToken'], 'refresh-1');
    });
  });
}
