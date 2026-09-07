/// Run with:
/// flutter test test/local_qa_solana_fee_display_active_test.dart \
///   --dart-define=AUVORA_QA_LOCAL_SOLANA=true
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/release/auvora_qa_local_solana.dart';
import 'package:auvora_wallet/transfer/address_validation.dart';
import 'package:auvora_wallet/transfer/local_qa_transfer_display.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Local Solana QA active (dart-define)', () {
    test('isActive', () {
      if (!AuvoraQaLocalSolana.isActive) {
        // ignore: avoid_print
        print('Skipping test: requires --dart-define=AUVORA_QA_LOCAL_SOLANA=true');
        return;
      }
      expect(AuvoraQaLocalSolana.isActive, isTrue);
    });

    test('static estimateFee uses QA SOL and feeUsd 0', () {
      if (!AuvoraQaLocalSolana.isActive) return;
      final fee = estimateFee(
        asset: const AssetHolding(
          id: 'sol',
          name: 'Solana',
          ticker: 'SOL',
          network: AssetNetwork.solana,
          balance: 20,
          priceUsd: 200,
          change24hPct: 0,
          color: 0xFF14F195,
        ),
        amount: 0.0001,
      );
      expect(fee.feeAsset, 'QA SOL');
      expect(fee.feeUsd, 0);
      final line = LocalQaTransferDisplay.feeLine(
        fee: fee,
        money: (v) => '\$${v.toStringAsFixed(2)}',
      );
      expect(line, '0.000005 QA SOL');
      expect(LocalQaTransferDisplay.containsFiatMarkers(line), isFalse);
    });

    test('amountLine uses QA SOL without fiat', () {
      if (!AuvoraQaLocalSolana.isActive) return;
      final line = LocalQaTransferDisplay.amountLine(
        amount: 0.0001,
        asset: const AssetHolding(
          id: 'sol',
          name: 'Solana',
          ticker: 'SOL',
          network: AssetNetwork.solana,
          balance: 20,
          priceUsd: 200,
          change24hPct: 0,
          color: 0xFF14F195,
        ),
        money: (v) => '\$${v.toStringAsFixed(2)}',
        qaNotionalUsdCents: 1,
      );
      expect(line, '0.000100 QA SOL');
      expect(LocalQaTransferDisplay.containsFiatMarkers(line), isFalse);
    });

    test('availableLine suppresses fiat', () {
      if (!AuvoraQaLocalSolana.isActive) return;
      final line = LocalQaTransferDisplay.availableLine(
        asset: const AssetHolding(
          id: 'sol',
          name: 'Solana',
          ticker: 'SOL',
          network: AssetNetwork.solana,
          balance: 20,
          priceUsd: 200,
          change24hPct: 0,
          color: 0xFF14F195,
        ),
        cryptoBalance: '20 SOL',
        money: (v) => '\$${v.toStringAsFixed(2)}',
      );
      expect(line, contains('LOCAL QA'));
      expect(line, contains('No monetary value'));
      expect(LocalQaTransferDisplay.containsFiatMarkers(line), isFalse);
    });
  });
}
