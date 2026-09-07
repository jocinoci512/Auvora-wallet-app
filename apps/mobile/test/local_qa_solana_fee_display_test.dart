import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/release/auvora_qa_local_solana.dart';
import 'package:auvora_wallet/transfer/address_validation.dart';
import 'package:auvora_wallet/transfer/local_qa_transfer_display.dart';
import 'package:flutter_test/flutter_test.dart';

AssetHolding _sol({required double priceUsd}) => AssetHolding(
      id: 'sol',
      name: 'Solana',
      ticker: 'SOL',
      network: AssetNetwork.solana,
      balance: 20,
      priceUsd: priceUsd,
      change24hPct: 0,
      color: 0xFF14F195,
    );

AssetHolding _eth({required double priceUsd}) => AssetHolding(
      id: 'eth',
      name: 'Ethereum',
      ticker: 'ETH',
      network: AssetNetwork.ethereum,
      balance: 1,
      priceUsd: priceUsd,
      change24hPct: 0,
      color: 0xFF627EEA,
    );

void main() {
  group('Local Solana QA transfer display', () {
    test('production Solana static fee may include fiat from asset.priceUsd', () {
      expect(AuvoraQaLocalSolana.isActive, isFalse);
      final fee = estimateFee(asset: _sol(priceUsd: 200), amount: 0.0001);
      expect(fee.feeCrypto, closeTo(0.00005, 1e-12));
      expect(fee.feeAsset, 'SOL');
      expect(fee.feeUsd, closeTo(0.01, 1e-9));
      final line = LocalQaTransferDisplay.feeLine(
        fee: fee,
        money: (v) => '\$${v.toStringAsFixed(2)}',
      );
      expect(line, contains(r'$0.01'));
      expect(LocalQaTransferDisplay.containsFiatMarkers(line), isTrue);
    });

    test('QA SOL fee line never renders USD even if feeUsd is poisoned', () {
      final fee = FeeEstimate(
        feeCrypto: 0.00005,
        feeUsd: 999,
        feeAsset: 'QA SOL',
        arrivalLabel: 'Usually under a minute',
        isLive: true,
      );
      final line = LocalQaTransferDisplay.feeLine(
        fee: fee,
        money: (_) => throw StateError('money must not run for QA SOL'),
        asset: _sol(priceUsd: 200),
      );
      expect(line, '0.00005 QA SOL');
      expect(LocalQaTransferDisplay.containsFiatMarkers(line), isFalse);
    });

    test('preferred Local QA amount/fee labels are QA SOL', () {
      expect(AuvoraQaLocalSolana.nativeAssetLabel, 'QA SOL');
      expect(AuvoraQaLocalSolana.feeAssetLabel, 'QA SOL');
      expect(LocalQaTransferDisplay.containsFiatMarkers('0.000100 QA SOL'), isFalse);
      expect(LocalQaTransferDisplay.containsFiatMarkers('0.00005 QA SOL'), isFalse);
    });

    test('production Solana amount line may include fiat via money()', () {
      final line = LocalQaTransferDisplay.amountLine(
        amount: 0.0001,
        asset: _sol(priceUsd: 200),
        money: (v) => '\$${v.toStringAsFixed(2)}',
      );
      expect(AuvoraQaLocalSolana.isActive, isFalse);
      expect(line, contains(r'$'));
      expect(line, contains('SOL'));
    });

    test('display formatters do not sign or broadcast', () {
      final fee = FeeEstimate(
        feeCrypto: 0.00005,
        feeUsd: 0,
        feeAsset: 'QA SOL',
        arrivalLabel: 'Usually under a minute',
        isLive: true,
      );
      final line = LocalQaTransferDisplay.feeLine(fee: fee, money: (v) => '\$$v');
      expect(line, isNot(contains('Sign')));
      expect(line, isNot(contains('broadcast')));
    });

    test('EVM QA ETH live fee with feeUsd 0 never shows dollar', () {
      final fee = FeeEstimate(
        feeCrypto: 0.000021,
        feeUsd: 0,
        feeAsset: 'QA ETH',
        arrivalLabel: '~15 sec',
        isLive: true,
      );
      final line = LocalQaTransferDisplay.feeLine(
        fee: fee,
        money: (v) => '\$${v.toStringAsFixed(2)}',
        asset: _eth(priceUsd: 3000),
      );
      expect(line, isNot(contains(r'$')));
      expect(line, contains('QA ETH'));
    });

    test('live lamport fee 5000 maps to 0.000005 QA SOL display', () {
      const lamports = 5000;
      final feeCrypto = lamports / 1000000000;
      final fee = FeeEstimate(
        feeCrypto: feeCrypto,
        feeUsd: 0.01 * 200, // poisoned market conversion
        feeAsset: 'QA SOL',
        arrivalLabel: 'Usually under a minute',
        isLive: true,
      );
      expect(fee.feeCrypto, closeTo(0.000005, 1e-12));
      final line = LocalQaTransferDisplay.feeLine(fee: fee, money: (v) => '\$${v.toStringAsFixed(2)}');
      expect(line, '0.000005 QA SOL');
    });
  });
}
