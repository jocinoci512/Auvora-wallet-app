import 'package:auvora_wallet/engine/onramp_config.dart';
import 'package:auvora_wallet/release/integration_config.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:auvora_wallet/wallet_engine/rpc_endpoints.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('IntegrationConfig readiness never exposes secret values', () {
    final summary = IntegrationConfig.readinessSummary();
    expect(summary.containsKey('coinGeckoKey'), isTrue);
    expect(summary['coinGeckoKey'], isA<bool>());
    expect(summary['wcProjectId'], isA<bool>());
    expect(summary['sentryReady'], isA<bool>());
    // No raw key material in the map values.
    for (final value in summary.values) {
      expect(value, anyOf(isA<bool>(), isA<num>(), isNull));
    }
  });

  test('RpcEndpoints provide failover lists for every ChainId', () {
    for (final chain in ChainId.values) {
      final urls = RpcEndpoints.urlsFor(chain);
      expect(urls, isNotEmpty, reason: chain.key);
      expect(urls.every((u) => u.startsWith('https://')), isTrue);
    }
  });

  test('RpcEndpoints displayLabel redacts Alchemy v2 paths', () {
    final label = RpcEndpoints.displayLabel(
      'https://eth-mainnet.g.alchemy.com/v2/super-secret-key',
    );
    expect(label, contains('••••'));
    expect(label, isNot(contains('super-secret-key')));
  });

  test('OnRampConfig widget URIs are null without compiled keys', () {
    expect(
      OnRampConfig.widgetUri(code: 'moonpay', assetSymbol: 'ETH', fiatUsd: 50),
      isNull,
    );
    expect(
      OnRampConfig.widgetUri(code: 'ramp', assetSymbol: 'ETH', fiatUsd: 50),
      isNull,
    );
    expect(
      OnRampConfig.widgetUri(code: 'transak', assetSymbol: 'ETH', fiatUsd: 50),
      isNull,
    );
  });

  test('OnRampConfig unavailableReason is professional and non-empty', () {
    final reason = OnRampConfig.unavailableReason('moonpay');
    expect(reason, isNotEmpty);
    expect(reason.toLowerCase(), contains('partner'));
  });
}
