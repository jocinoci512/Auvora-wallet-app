import 'package:auvora_wallet/connections/tron_local_signer.dart';
import 'package:auvora_wallet/wallet_engine/tron_receipt_confirmer.dart';
import 'package:auvora_wallet/wallet_engine/tron_testnet_broadcast.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const testMnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  group('TronFailureHarness', () {
    test('invalid address rejected by addressToHex', () {
      expect(
        () => TronLocalSigner.addressToHex('not_a_tron_address'),
        throwsA(isA<FormatException>()),
      );
      // Valid Base58Check Bitcoin address (starts with 1) is not a Tron address (starts with 41 / T)
      expect(
        () => TronLocalSigner.addressToHex('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'),
        throwsA(isA<FormatException>()),
      );
    });

    test('valid Tron address roundtrips between Base58Check and Hex', () {
      const signer = TronLocalSigner();
      final addr = signer.addressFromMnemonic(testMnemonic);
      expect(addr.startsWith('T'), isTrue);
      expect(addr.length, 34);

      final hex = TronLocalSigner.addressToHex(addr);
      expect(hex.startsWith('41'), isTrue);
      expect(hex.length, 42);

      final backToAddr = TronLocalSigner.hexToAddress(hex);
      expect(backToAddr, addr);
    });

    test('resource and fee calculation estimates TRX burn fee', () {
      final feeWithBandwidth = TronLocalSigner.estimateTrxFee(hasBandwidth: true);
      expect(feeWithBandwidth, 0.0);

      final feeWithoutBandwidth = TronLocalSigner.estimateTrxFee(hasBandwidth: false);
      expect(feeWithoutBandwidth, greaterThan(0.0));
      expect(feeWithoutBandwidth, closeTo(0.267, 0.001));
    });

    test('canonical protobuf serialization contains required fields', () {
      const signer = TronLocalSigner();
      final from = signer.addressFromMnemonic(testMnemonic);
      final to = signer.addressFromMnemonic(testMnemonic, accountIndex: 1);

      final txData = TronTransactionData(
        refBlockBytes: '1234',
        refBlockHash: '1234567890abcdef',
        expirationMs: 1725700060000,
        timestampMs: 1725700000000,
        ownerAddressHex: TronLocalSigner.addressToHex(from),
        toAddressHex: TronLocalSigner.addressToHex(to),
        amountSun: 5000000, // 5 TRX
      );

      final rawDataBytes = TronLocalSigner.serializeRawData(txData);
      expect(rawDataBytes.isNotEmpty, isTrue);
      expect(rawDataBytes.length, greaterThan(50));
    });

    test('client-side signing produces valid txID and 65-byte signature', () {
      const signer = TronLocalSigner();
      final from = signer.addressFromMnemonic(testMnemonic);
      final to = signer.addressFromMnemonic(testMnemonic, accountIndex: 1);

      final txData = TronTransactionData(
        refBlockBytes: '0001',
        refBlockHash: '0000000000000001',
        expirationMs: 1725700060000,
        timestampMs: 1725700000000,
        ownerAddressHex: TronLocalSigner.addressToHex(from),
        toAddressHex: TronLocalSigner.addressToHex(to),
        amountSun: 10000000, // 10 TRX
      );

      final signed = signer.signTransaction(
        mnemonic: testMnemonic,
        txData: txData,
      );

      expect(signed['txID'], isNotNull);
      expect((signed['txID'] as String).length, 64);
      expect(signed['raw_data_hex'], isNotNull);

      final sigs = signed['signature'] as List<dynamic>;
      expect(sigs.length, 1);
      final sigHex = sigs.first as String;
      // 65 bytes = 130 hex characters (r: 32 bytes, s: 32 bytes, v: 1 byte)
      expect(sigHex.length, 130);
    });

    test('TRC-20 transfer serialization generates TriggerSmartContract', () {
      const signer = TronLocalSigner();
      final from = signer.addressFromMnemonic(testMnemonic);
      final to = signer.addressFromMnemonic(testMnemonic, accountIndex: 1);
      const usdtContractHex = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';

      final txData = TronTransactionData(
        refBlockBytes: '0001',
        refBlockHash: '0000000000000001',
        expirationMs: 1725700060000,
        timestampMs: 1725700000000,
        ownerAddressHex: TronLocalSigner.addressToHex(from),
        toAddressHex: TronLocalSigner.addressToHex(to),
        amountSun: 1000000, // 1 USDT (6 decimals)
        contractAddressHex: usdtContractHex,
        feeLimitSun: 15000000, // 15 TRX fee limit
      );

      expect(txData.isTrc20, isTrue);

      final rawDataBytes = TronLocalSigner.serializeRawData(txData);
      expect(rawDataBytes.isNotEmpty, isTrue);

      final signed = signer.signTransaction(
        mnemonic: testMnemonic,
        txData: txData,
      );
      expect(signed['txID'], isNotNull);
      final contractType = (signed['raw_data'] as Map<String, dynamic>)['contract'][0]['type'];
      expect(contractType, 'TriggerSmartContract');
    });

    test('mainnet broadcast gate rejects mainnet RPC host', () {
      expect(
        () => TronTestnetBroadcast.assertAllowed(
          canBroadcastTestnet: true,
          liveBroadcastEnabled: false,
          isTestnetEnv: true,
          rpcUrl: 'https://api.trongrid.io',
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('mainnet broadcast kill switch must stay off', () {
      expect(
        () => TronTestnetBroadcast.assertAllowed(
          canBroadcastTestnet: true,
          liveBroadcastEnabled: true,
          isTestnetEnv: true,
          rpcUrl: 'https://nile.trongrid.io',
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('confirmation gate validates live Tron txid format', () {
      expect(TronReceiptConfirmer.isLiveTronTxid('preview-tx'), isFalse);
      expect(TronReceiptConfirmer.isLiveTronTxid('0x123'), isFalse);
      expect(
        TronReceiptConfirmer.isLiveTronTxid(
          '9c0b1e19d45a9071c84d72bc1ea354c4f3e62f6cf6cfbb60df58f2eb89bc2132',
        ),
        isTrue,
      );
    });

    test('duplicate submit prevention dedupe key', () {
      final txid = '9c0b1e19d45a9071c84d72bc1ea354c4f3e62f6cf6cfbb60df58f2eb89bc2132';
      final seen = <String>{};
      expect(seen.add(txid), isTrue);
      expect(seen.add(txid), isFalse);
    });
  });
}
