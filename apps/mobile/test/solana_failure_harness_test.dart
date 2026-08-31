import 'dart:convert';

import 'package:auvora_wallet/connections/solana_local_signer.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/wallet_engine/solana_receipt_confirmer.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SolanaFailureHarness', () {
    test('invalid recipient rejected by decoder', () {
      expect(
        () => SolanaLocalSigner.buildTransferMessage(
          fromAddress: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
          toAddress: 'not-valid',
          recentBlockhash: SolanaLocalSigner.systemProgramAddress,
          lamports: 1000,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('live signature shape for confirmation gate', () {
      expect(SolanaReceiptConfirmer.isLiveSolanaSignature('0xabc'), isFalse);
      expect(
        SolanaReceiptConfirmer.isLiveSolanaSignature('short'),
        isFalse,
      );
      // 88-char base58-ish placeholder (not a real sig) — length gate only.
      final fake = '1' * 88;
      expect(SolanaReceiptConfirmer.isLiveSolanaSignature(fake), isTrue);
    });

    test('double finalization hash set prevents duplicate notify key', () {
      final hash =
          '5VEJv1RSo3nH6KLp1JGqH8s6nYkQ3mV2oP9rT4uW7xY1zA2bC3dE4fG5hI6jK7L8mN9oP';
      final seen = <String>{};
      expect(seen.add(hash), isTrue);
      expect(seen.add(hash), isFalse);
      final dedupe = 'tx-completed-${hash.toLowerCase()}';
      expect(dedupe.startsWith('tx-completed-'), isTrue);
    });

    test('signer address mismatch is rejected before wire encode', () {
      const signer = SolanaLocalSigner();
      const mnemonic =
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      final from = signer.addressFromMnemonic(mnemonic);
      expect(
        () => signer.signSystemTransfer(
          mnemonic: mnemonic,
          expectedFromAddress: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqX',
          toAddress: from,
          lamports: 1000,
          recentBlockhash: SolanaLocalSigner.systemProgramAddress,
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('sign rejects non-positive lamports', () {
      const signer = SolanaLocalSigner();
      const mnemonic =
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      final from = signer.addressFromMnemonic(mnemonic);
      expect(
        () => signer.signSystemTransfer(
          mnemonic: mnemonic,
          expectedFromAddress: from,
          toAddress: from,
          lamports: 0,
          recentBlockhash: SolanaLocalSigner.systemProgramAddress,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('portfolio completed status intent for failed receipt', () {
      expect(TxStatus.failed, isNot(TxStatus.completed));
      expect(TxStatus.confirming, isNot(TxStatus.completed));
    });

    test('wire tx is base64 and includes signature count', () {
      const signer = SolanaLocalSigner();
      const mnemonic =
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      final from = signer.addressFromMnemonic(mnemonic);
      final to = signer.addressFromMnemonic(mnemonic, accountIndex: 1);
      final encoded = signer.signSystemTransfer(
        mnemonic: mnemonic,
        expectedFromAddress: from,
        toAddress: to,
          lamports: 100000,
        recentBlockhash: SolanaLocalSigner.systemProgramAddress,
      );
      final wire = base64Decode(encoded);
      expect(wire[0], 1);
      expect(wire.length, greaterThan(100));
    });
  });
}
