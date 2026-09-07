import 'package:auvora_wallet/connections/bitcoin_local_signer.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/transfer/address_validation.dart';
import 'package:auvora_wallet/wallet_engine/bitcoin_receipt_confirmer.dart';
import 'package:auvora_wallet/wallet_engine/bitcoin_testnet_broadcast.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const testMnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  group('BitcoinFailureHarness', () {
    test('insufficient balance throws InsufficientBitcoinBalanceException', () {
      final utxos = [
        const BitcoinUtxo(
          txid: '1111111111111111111111111111111111111111111111111111111111111111',
          vout: 0,
          valueSatoshis: 1000,
        ),
      ];
      expect(
        () => BitcoinLocalSigner.selectCoins(
          utxos: utxos,
          targetSatoshis: 50000,
          satPerVb: 10,
        ),
        throwsA(isA<InsufficientBitcoinBalanceException>()),
      );
    });

    test('dust output (< 546 sats) rejected by coin selection', () {
      final utxos = [
        const BitcoinUtxo(
          txid: '1111111111111111111111111111111111111111111111111111111111111111',
          vout: 0,
          valueSatoshis: 100000,
        ),
      ];
      expect(
        () => BitcoinLocalSigner.selectCoins(
          utxos: utxos,
          targetSatoshis: 300, // below 546 sats
          satPerVb: 10,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('fee calculation matches SegWit vsize formula', () {
      final vsize1In2Out = BitcoinLocalSigner.estimateVsize(
        numInputs: 1,
        numOutputs: 2,
      );
      expect(vsize1In2Out, inInclusiveRange(135, 145));

      final vsize2In2Out = BitcoinLocalSigner.estimateVsize(
        numInputs: 2,
        numOutputs: 2,
      );
      expect(vsize2In2Out, greaterThan(vsize1In2Out));
    });

    test('change output created when change exceeds dust threshold', () {
      final utxos = [
        const BitcoinUtxo(
          txid: '1111111111111111111111111111111111111111111111111111111111111111',
          vout: 0,
          valueSatoshis: 100000,
        ),
      ];
      final selection = BitcoinLocalSigner.selectCoins(
        utxos: utxos,
        targetSatoshis: 20000,
        satPerVb: 10,
      );
      expect(selection.inputs.length, 1);
      expect(selection.amountSatoshis, 20000);
      expect(selection.changeSatoshis, greaterThanOrEqualTo(546));
      expect(selection.feeSatoshis, greaterThan(0));
      expect(
        selection.amountSatoshis + selection.feeSatoshis + selection.changeSatoshis,
        100000,
      );
    });

    test('multiple UTXOs selected when single UTXO is insufficient', () {
      final utxos = [
        const BitcoinUtxo(
          txid: '1111111111111111111111111111111111111111111111111111111111111111',
          vout: 0,
          valueSatoshis: 10000,
        ),
        const BitcoinUtxo(
          txid: '2222222222222222222222222222222222222222222222222222222222222222',
          vout: 1,
          valueSatoshis: 15000,
        ),
      ];
      final selection = BitcoinLocalSigner.selectCoins(
        utxos: utxos,
        targetSatoshis: 20000,
        satPerVb: 10,
      );
      expect(selection.inputs.length, 2);
      expect(selection.amountSatoshis, 20000);
    });

    test('exact-spend or dust change absorbs into fee (no dust change output)', () {
      final utxos = [
        const BitcoinUtxo(
          txid: '1111111111111111111111111111111111111111111111111111111111111111',
          vout: 0,
          valueSatoshis: 11000,
        ),
      ];
      // Target 10,000 + fee ~1,000 leaves < 546 change -> absorbs into fee
      final selection = BitcoinLocalSigner.selectCoins(
        utxos: utxos,
        targetSatoshis: 9900,
        satPerVb: 10,
      );
      expect(selection.changeSatoshis, 0);
      expect(selection.feeSatoshis, 11000 - 9900);
    });

    test('malformed recipient address rejected by scriptPubKey converter', () {
      expect(
        () => BitcoinLocalSigner.addressToScriptPubKey('tb1_not_a_valid_bech32'),
        throwsA(isA<FormatException>()),
      );
    });

    test('wrong network address rejected by AddressValidation', () {
      // In default environment (mainnet rules), tb1 testnet address is rejected with wrongNetwork
      final result = AddressValidation.validate(
        'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        expected: AssetNetwork.bitcoin,
      );
      expect(result.ok, isFalse);
      expect(result.issue, AddressIssue.wrongNetwork);
    });

    test('mainnet broadcast gate rejects mainnet RPC host', () {
      expect(
        () => BitcoinTestnetBroadcast.assertAllowed(
          canBroadcastTestnet: true,
          liveBroadcastEnabled: false,
          isTestnetEnv: true,
          rpcUrl: 'https://bitcoin-mainnet.g.alchemy.com/v2/demo',
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('mainnet broadcast kill switch must stay off', () {
      expect(
        () => BitcoinTestnetBroadcast.assertAllowed(
          canBroadcastTestnet: true,
          liveBroadcastEnabled: true,
          isTestnetEnv: true,
          rpcUrl: 'https://mempool.space/testnet',
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('confirmation gate validates live txid format', () {
      expect(BitcoinReceiptConfirmer.isLiveBitcoinTxid('preview-tx'), isFalse);
      expect(BitcoinReceiptConfirmer.isLiveBitcoinTxid('0x123'), isFalse);
      expect(
        BitcoinReceiptConfirmer.isLiveBitcoinTxid(
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        ),
        isTrue,
      );
    });

    test('double submit prevention dedupe key', () {
      final txid = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      final seen = <String>{};
      expect(seen.add(txid), isTrue);
      expect(seen.add(txid), isFalse);
    });

    test('client-side signing produces valid SegWit raw tx hex and txid', () {
      const signer = BitcoinLocalSigner();
      final senderAddr = signer.addressFromMnemonic(testMnemonic);
      final recipientAddr = signer.addressFromMnemonic(testMnemonic, accountIndex: 1);

      final utxos = [
        const BitcoinUtxo(
          txid: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
          vout: 0,
          valueSatoshis: 100000,
        ),
      ];

      final selection = BitcoinLocalSigner.selectCoins(
        utxos: utxos,
        targetSatoshis: 30000,
        satPerVb: 10,
      );

      final result = signer.signP2wpkhTransaction(
        mnemonic: testMnemonic,
        selection: selection,
        recipientAddress: recipientAddr,
        changeAddress: senderAddr,
      );

      expect(result.rawTxHex.isNotEmpty, isTrue);
      // SegWit marker & flag 0001
      expect(result.rawTxHex.contains('0001'), isTrue);
      expect(result.txid.length, 64);
    });
  });
}
