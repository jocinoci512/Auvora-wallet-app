import 'package:auvora_wallet/wallet_engine/evm_receipt_confirmer.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EvmReceiptConfirmer.parseReceipt', () {
    test('success receipt parses fee and block', () {
      final receipt = EvmReceiptConfirmer.parseReceipt({
        'status': '0x1',
        'blockNumber': '0x4d2',
        'gasUsed': '0x5208',
        'effectiveGasPrice': '0x3b9aca07',
      });
      expect(receipt, isNotNull);
      expect(receipt!.success, isTrue);
      expect(receipt.blockNumber, 1234);
      expect(receipt.gasUsed, BigInt.from(21000));
      expect(receipt.effectiveGasPrice, BigInt.parse('1000000007'));
      expect(receipt.feeWei, BigInt.parse('21000000147000'));
      expect(receipt.feeNative, closeTo(0.000021000000147, 1e-15));
    });

    test('revert receipt marks failure', () {
      final receipt = EvmReceiptConfirmer.parseReceipt({
        'status': '0x0',
        'blockNumber': '0x1',
        'gasUsed': '0x5208',
        'effectiveGasPrice': '0x3b9aca07',
      });
      expect(receipt, isNotNull);
      expect(receipt!.success, isFalse);
    });

    test('missing fields return null', () {
      expect(EvmReceiptConfirmer.parseReceipt({'status': '0x1'}), isNull);
    });
  });

  group('TxStatus.matchesActivityFilter', () {
    test('pending filter includes confirming', () {
      expect(TxStatus.confirming.matchesActivityFilter(TxStatus.pending), isTrue);
      expect(TxStatus.completed.matchesActivityFilter(TxStatus.pending), isFalse);
    });
  });

  group('live hash detection', () {
    test('validates 32-byte hash', () {
      expect(
        EvmReceiptConfirmer.isLiveEvmTxHash(
          '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f',
        ),
        isTrue,
      );
      expect(EvmReceiptConfirmer.isLiveEvmTxHash('0xabc'), isFalse);
    });
  });
}
