import 'dart:convert';

import 'package:auvora_wallet/connections/solana_local_signer.dart';
import 'package:auvora_wallet/crypto/hd_derivation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  test('builds deterministic signed legacy System Program transfer', () {
    const signer = SolanaLocalSigner();
    final from = signer.addressFromMnemonic(mnemonic);
    final to = signer.addressFromMnemonic(mnemonic, accountIndex: 1);

    expect(from, 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    final encoded = signer.signSystemTransfer(
      mnemonic: mnemonic,
      expectedFromAddress: from,
      toAddress: to,
      lamports: 1000,
      recentBlockhash: SolanaLocalSigner.systemProgramAddress,
    );

    final wire = base64Decode(encoded);
    expect(wire.length, greaterThan(64));
    // shortvec(signature count) + signature, then message header + account count.
    expect(wire[0], 1);
    expect(wire.sublist(65, 69), [1, 0, 1, 3]);
    final systemProgramOffset = 69 + 64;
    expect(
      wire.sublist(systemProgramOffset, systemProgramOffset + 32),
      HdDerivation.base58Decode(SolanaLocalSigner.systemProgramAddress),
    );
  });
}
