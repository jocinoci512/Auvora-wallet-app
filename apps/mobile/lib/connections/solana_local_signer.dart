/// Local Solana signing for legacy System Program transfers.
///
/// Keys stay on-device. This class builds and signs wire transactions but
/// never broadcasts them.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:pinenacl/ed25519.dart';

import '../crypto/hd_derivation.dart';
import '../portfolio/models.dart';

class SolanaLocalSigner {
  const SolanaLocalSigner();

  static const systemProgramAddress = '11111111111111111111111111111111';

  SigningKey signingKeyFromMnemonic(
    String mnemonic, {
    int accountIndex = 0,
  }) {
    final seed = HdDerivation.deriveSolanaPrivateKey(
      mnemonic: mnemonic,
      accountIndex: accountIndex,
    );
    return SigningKey.fromSeed(seed);
  }

  String addressFromMnemonic(String mnemonic, {int accountIndex = 0}) {
    return HdDerivation.deriveAddress(
      mnemonic: mnemonic,
      network: AssetNetwork.solana,
      accountIndex: accountIndex,
    );
  }

  /// Returns a base64-encoded Solana legacy wire transaction.
  String signSystemTransfer({
    required String mnemonic,
    required String expectedFromAddress,
    required String toAddress,
    required int lamports,
    required String recentBlockhash,
    int accountIndex = 0,
  }) {
    if (lamports <= 0) throw ArgumentError.value(lamports, 'lamports');
    final signerAddress =
        addressFromMnemonic(mnemonic, accountIndex: accountIndex);
    if (signerAddress != expectedFromAddress.trim()) {
      throw StateError(
          'Derived Solana signer does not match transaction sender.');
    }

    final message = buildTransferMessage(
      fromAddress: expectedFromAddress,
      toAddress: toAddress,
      recentBlockhash: recentBlockhash,
      lamports: lamports,
    );
    final signature = signingKeyFromMnemonic(
      mnemonic,
      accountIndex: accountIndex,
    ).sign(message).signature.asTypedList;
    final wire = Uint8List.fromList([
      ..._shortVec(1),
      ...signature,
      ...message,
    ]);
    return base64Encode(wire);
  }

  static Uint8List buildTransferMessage({
    required String fromAddress,
    required String toAddress,
    required String recentBlockhash,
    required int lamports,
  }) {
    final from = _decode32(fromAddress, 'sender');
    final to = _decode32(toAddress, 'recipient');
    final systemProgram = _decode32(systemProgramAddress, 'System Program');
    final blockhash = _decode32(recentBlockhash, 'recent blockhash');
    final data = ByteData(12)
      ..setUint32(0, 2, Endian.little)
      ..setUint64(4, lamports, Endian.little);
    return Uint8List.fromList([
      1, // required signatures
      0, // readonly signed accounts
      1, // readonly unsigned accounts (System Program)
      ..._shortVec(3),
      ...from,
      ...to,
      ...systemProgram,
      ...blockhash,
      ..._shortVec(1),
      2, // System Program account index
      ..._shortVec(2),
      0, 1, // from, to
      ..._shortVec(data.lengthInBytes),
      ...data.buffer.asUint8List(),
    ]);
  }

  static Uint8List _decode32(String value, String label) {
    final decoded = HdDerivation.base58Decode(value.trim());
    if (decoded.length != 32) {
      throw FormatException('Invalid Solana $label.');
    }
    return decoded;
  }

  static List<int> _shortVec(int value) {
    if (value < 0) throw ArgumentError.value(value);
    final out = <int>[];
    var remaining = value;
    do {
      var next = remaining & 0x7f;
      remaining >>= 7;
      if (remaining != 0) next |= 0x80;
      out.add(next);
    } while (remaining != 0);
    return out;
  }
}
