import 'dart:async';

import 'package:auvora_wallet/account/auth_api_client.dart';
import 'package:auvora_wallet/account/auvora_connectivity.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

void main() {
  test('transport failures map to an Auvora offline message, not generic no-internet copy', () {
    final mapped = AuvoraConnectivity.fromTransportOrUnknown(
      http.ClientException('Connection refused'),
    );
    expect(mapped.kind, AuthErrorKind.network);
    expect(mapped.message, AuvoraConnectivity.offlineMessage);
    expect(mapped.message.toLowerCase(), isNot(contains('no internet connection')));
  });

  test('timeouts are degraded, not offline', () {
    final mapped = AuvoraConnectivity.fromTransportOrUnknown(
      TimeoutException('slow'),
    );
    expect(mapped.kind, AuthErrorKind.timeout);
    expect(mapped.message, AuvoraConnectivity.degradedMessage);
  });

  test('non-transport errors are unknown, not offline', () {
    final mapped = AuvoraConnectivity.fromTransportOrUnknown(FormatException('bad json'));
    expect(mapped.kind, AuthErrorKind.unknown);
    expect(mapped.message.toLowerCase(), isNot(contains('no internet')));
  });
}
