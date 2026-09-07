/// Local Bitcoin SegWit (BIP-84) signing and coin selection.
///
/// Keys stay on-device. This class constructs standard P2WPKH witness transactions,
/// signs them locally using RFC 6979 deterministic secp256k1 ECDSA, and produces
/// standard raw transaction hex for testnet / regtest broadcast.
library;

import 'dart:typed_data';

import 'package:convert/convert.dart';
import 'package:crypto/crypto.dart' as crypto;
import 'package:pointycastle/export.dart';

import '../crypto/hd_derivation.dart';
import '../portfolio/models.dart';

class BitcoinUtxo {
  const BitcoinUtxo({
    required this.txid,
    required this.vout,
    required this.valueSatoshis,
    this.scriptPubKey,
  });

  final String txid;
  final int vout;
  final int valueSatoshis;
  final Uint8List? scriptPubKey;

  factory BitcoinUtxo.fromJson(Map<String, dynamic> json) {
    return BitcoinUtxo(
      txid: json['txid'] as String? ?? '',
      vout: (json['vout'] as num?)?.toInt() ?? 0,
      valueSatoshis: (json['value'] as num?)?.toInt() ??
          (json['valueSatoshis'] as num?)?.toInt() ??
          0,
    );
  }

  Map<String, dynamic> toJson() => {
        'txid': txid,
        'vout': vout,
        'valueSatoshis': valueSatoshis,
      };
}

class BitcoinCoinSelection {
  const BitcoinCoinSelection({
    required this.inputs,
    required this.amountSatoshis,
    required this.feeSatoshis,
    required this.changeSatoshis,
    required this.estimatedVsize,
  });

  final List<BitcoinUtxo> inputs;
  final int amountSatoshis;
  final int feeSatoshis;
  final int changeSatoshis;
  final int estimatedVsize;
}

class InsufficientBitcoinBalanceException implements Exception {
  const InsufficientBitcoinBalanceException(this.message);
  final String message;

  @override
  String toString() => message;
}

class BitcoinLocalSigner {
  const BitcoinLocalSigner();

  /// Standard Bitcoin SegWit dust threshold (BIP 141).
  static const int dustThresholdSatoshis = 546;

  /// Default testnet fee rate in sat/vB.
  static const int defaultFeeRateSatPerVb = 10;

  /// Estimate virtual size in vB for a P2WPKH transaction.
  /// Overhead: ~10.5 vB, each P2WPKH input: ~68 vB, each P2WPKH output: ~31 vB.
  static int estimateVsize({required int numInputs, required int numOutputs}) {
    final weight = (10 * 4) + (numInputs * (41 * 4 + 107)) + (numOutputs * 31 * 4);
    return (weight + 3) ~/ 4;
  }

  /// Select coins using largest-first greedy selection with dynamic fee recalculation.
  static BitcoinCoinSelection selectCoins({
    required List<BitcoinUtxo> utxos,
    required int targetSatoshis,
    int satPerVb = defaultFeeRateSatPerVb,
  }) {
    if (targetSatoshis < dustThresholdSatoshis) {
      throw ArgumentError(
        'Transfer amount ($targetSatoshis sats) is below the Bitcoin dust threshold ($dustThresholdSatoshis sats).',
      );
    }
    if (utxos.isEmpty) {
      throw const InsufficientBitcoinBalanceException(
        'No spendable Bitcoin UTXOs available.',
      );
    }

    final sorted = List<BitcoinUtxo>.from(utxos)
      ..sort((a, b) => b.valueSatoshis.compareTo(a.valueSatoshis));

    final selected = <BitcoinUtxo>[];
    var accumulated = 0;

    for (final utxo in sorted) {
      selected.add(utxo);
      accumulated += utxo.valueSatoshis;

      // Estimate fee assuming a change output is needed (2 outputs).
      final vsizeWithChange = estimateVsize(
        numInputs: selected.length,
        numOutputs: 2,
      );
      final feeWithChange = vsizeWithChange * satPerVb;

      if (accumulated >= targetSatoshis + feeWithChange) {
        final change = accumulated - targetSatoshis - feeWithChange;
        if (change < dustThresholdSatoshis) {
          // Absorb dust change into fee (1 output only).
          final vsizeNoChange = estimateVsize(
            numInputs: selected.length,
            numOutputs: 1,
          );
          final feeNoChange = accumulated - targetSatoshis;
          return BitcoinCoinSelection(
            inputs: selected,
            amountSatoshis: targetSatoshis,
            feeSatoshis: feeNoChange,
            changeSatoshis: 0,
            estimatedVsize: vsizeNoChange,
          );
        }
        return BitcoinCoinSelection(
          inputs: selected,
          amountSatoshis: targetSatoshis,
          feeSatoshis: feeWithChange,
          changeSatoshis: change,
          estimatedVsize: vsizeWithChange,
        );
      }
    }

    // Check exact spend or dust change with 1 output.
    final vsize1Out = estimateVsize(numInputs: selected.length, numOutputs: 1);
    final fee1Out = vsize1Out * satPerVb;
    if (accumulated >= targetSatoshis + fee1Out) {
      final change = accumulated - targetSatoshis - fee1Out;
      if (change < dustThresholdSatoshis) {
        return BitcoinCoinSelection(
          inputs: selected,
          amountSatoshis: targetSatoshis,
          feeSatoshis: accumulated - targetSatoshis,
          changeSatoshis: 0,
          estimatedVsize: vsize1Out,
        );
      }
    }

    throw InsufficientBitcoinBalanceException(
      'Insufficient Bitcoin balance. Need at least $targetSatoshis sats + fees, available: $accumulated sats.',
    );
  }

  /// Derive the Bitcoin address from mnemonic.
  String addressFromMnemonic(String mnemonic, {int accountIndex = 0}) {
    return HdDerivation.deriveAddress(
      mnemonic: mnemonic,
      network: AssetNetwork.bitcoin,
      accountIndex: accountIndex,
    );
  }

  /// Construct and sign a SegWit (P2WPKH) transaction completely client-side.
  /// Returns raw transaction hex and calculated txid.
  ({String rawTxHex, String txid}) signP2wpkhTransaction({
    required String mnemonic,
    required BitcoinCoinSelection selection,
    required String recipientAddress,
    required String changeAddress,
    int accountIndex = 0,
  }) {
    final privateKeyBytes = HdDerivation.deriveBitcoinPrivateKey(
      mnemonic: mnemonic,
      accountIndex: accountIndex,
    );
    final pubKeyBytes = HdDerivation.bitcoinPublicKey(privateKeyBytes);

    // Validate recipient scriptPubKey.
    final recipientScript = addressToScriptPubKey(recipientAddress);
    final changeScript = selection.changeSatoshis >= dustThresholdSatoshis
        ? addressToScriptPubKey(changeAddress)
        : null;

    final outputs = <({int value, Uint8List script})>[
      (value: selection.amountSatoshis, script: recipientScript),
      if (changeScript != null && selection.changeSatoshis >= dustThresholdSatoshis)
        (value: selection.changeSatoshis, script: changeScript),
    ];

    // Compute hashPrevouts and hashSequence (BIP-143).
    final prevoutsBytes = BytesBuilder();
    final sequenceBytes = BytesBuilder();
    for (final input in selection.inputs) {
      final txidBytes = _hexToBytesReversed(input.txid);
      prevoutsBytes.add(txidBytes);
      final b = ByteData(4)..setUint32(0, input.vout, Endian.little);
      prevoutsBytes.add(b.buffer.asUint8List());

      final s = ByteData(4)..setUint32(0, 0xffffffff, Endian.little);
      sequenceBytes.add(s.buffer.asUint8List());
    }
    final hashPrevouts = _doubleSha256(prevoutsBytes.toBytes());
    final hashSequence = _doubleSha256(sequenceBytes.toBytes());

    // Compute hashOutputs (BIP-143).
    final outputsBytes = BytesBuilder();
    for (final out in outputs) {
      final b = ByteData(8)..setUint64(0, out.value, Endian.little);
      outputsBytes.add(b.buffer.asUint8List());
      outputsBytes.add(_varInt(out.script.length));
      outputsBytes.add(out.script);
    }
    final hashOutputs = _doubleSha256(outputsBytes.toBytes());

    // Pubkey hash for P2WPKH scriptCode: OP_DUP OP_HASH160 20-bytes OP_EQUALVERIFY OP_CHECKSIG
    final pubKeyHash = _hash160(pubKeyBytes);
    final scriptCode = Uint8List.fromList([
      0x19, // length 25
      0x76, // OP_DUP
      0xa9, // OP_HASH160
      0x14, // 20 bytes push
      ...pubKeyHash,
      0x88, // OP_EQUALVERIFY
      0xac, // OP_CHECKSIG
    ]);

    // Sign each input.
    final witnesses = <List<Uint8List>>[];
    for (var i = 0; i < selection.inputs.length; i++) {
      final input = selection.inputs[i];

      final sigHashPreimage = BytesBuilder();
      // 1. nVersion (4 bytes little-endian = 2)
      final v = ByteData(4)..setUint32(0, 2, Endian.little);
      sigHashPreimage.add(v.buffer.asUint8List());
      // 2. hashPrevouts
      sigHashPreimage.add(hashPrevouts);
      // 3. hashSequence
      sigHashPreimage.add(hashSequence);
      // 4. outpoint
      sigHashPreimage.add(_hexToBytesReversed(input.txid));
      final vo = ByteData(4)..setUint32(0, input.vout, Endian.little);
      sigHashPreimage.add(vo.buffer.asUint8List());
      // 5. scriptCode
      sigHashPreimage.add(scriptCode);
      // 6. amount (8 bytes little-endian)
      final val = ByteData(8)..setUint64(0, input.valueSatoshis, Endian.little);
      sigHashPreimage.add(val.buffer.asUint8List());
      // 7. nSequence (4 bytes little-endian)
      final seq = ByteData(4)..setUint32(0, 0xffffffff, Endian.little);
      sigHashPreimage.add(seq.buffer.asUint8List());
      // 8. hashOutputs
      sigHashPreimage.add(hashOutputs);
      // 9. nLocktime (4 bytes little-endian = 0)
      final lock = ByteData(4)..setUint32(0, 0, Endian.little);
      sigHashPreimage.add(lock.buffer.asUint8List());
      // 10. sighash type (4 bytes little-endian = 1 for SIGHASH_ALL)
      final sh = ByteData(4)..setUint32(0, 1, Endian.little);
      sigHashPreimage.add(sh.buffer.asUint8List());

      final sighash = _doubleSha256(sigHashPreimage.toBytes());

      // ECDSA Sign sighash with private key (RFC 6979 deterministic, low-s).
      final derSig = _signSecp256k1(sighash, privateKeyBytes);
      final sigWithHashType = Uint8List.fromList([...derSig, 0x01]); // SIGHASH_ALL

      witnesses.add([sigWithHashType, pubKeyBytes]);
    }

    // Assemble full SegWit wire transaction.
    final wire = BytesBuilder();
    // nVersion (4 bytes little-endian = 2)
    final v = ByteData(4)..setUint32(0, 2, Endian.little);
    wire.add(v.buffer.asUint8List());

    // SegWit marker & flag
    wire.add([0x00, 0x01]);

    // Input count
    wire.add(_varInt(selection.inputs.length));
    for (final input in selection.inputs) {
      wire.add(_hexToBytesReversed(input.txid));
      final vo = ByteData(4)..setUint32(0, input.vout, Endian.little);
      wire.add(vo.buffer.asUint8List());
      wire.add([0x00]); // scriptSig length 0 for SegWit
      final seq = ByteData(4)..setUint32(0, 0xffffffff, Endian.little);
      wire.add(seq.buffer.asUint8List());
    }

    // Output count
    wire.add(_varInt(outputs.length));
    for (final out in outputs) {
      final val = ByteData(8)..setUint64(0, out.value, Endian.little);
      wire.add(val.buffer.asUint8List());
      wire.add(_varInt(out.script.length));
      wire.add(out.script);
    }

    // Witness data for each input
    for (final witness in witnesses) {
      wire.add(_varInt(witness.length));
      for (final item in witness) {
        wire.add(_varInt(item.length));
        wire.add(item);
      }
    }

    // nLocktime (4 bytes little-endian = 0)
    final lock = ByteData(4)..setUint32(0, 0, Endian.little);
    wire.add(lock.buffer.asUint8List());

    final rawTxBytes = wire.toBytes();
    final rawTxHex = hex.encode(rawTxBytes);

    // Compute txid: Double-SHA256 of legacy serialization (no marker/flag/witness).
    final legacyWire = BytesBuilder();
    legacyWire.add(v.buffer.asUint8List());
    legacyWire.add(_varInt(selection.inputs.length));
    for (final input in selection.inputs) {
      legacyWire.add(_hexToBytesReversed(input.txid));
      final vo = ByteData(4)..setUint32(0, input.vout, Endian.little);
      legacyWire.add(vo.buffer.asUint8List());
      legacyWire.add([0x00]);
      final seq = ByteData(4)..setUint32(0, 0xffffffff, Endian.little);
      legacyWire.add(seq.buffer.asUint8List());
    }
    legacyWire.add(_varInt(outputs.length));
    for (final out in outputs) {
      final val = ByteData(8)..setUint64(0, out.value, Endian.little);
      legacyWire.add(val.buffer.asUint8List());
      legacyWire.add(_varInt(out.script.length));
      legacyWire.add(out.script);
    }
    legacyWire.add(lock.buffer.asUint8List());
    final legacyHash = _doubleSha256(legacyWire.toBytes());
    final txid = hex.encode(legacyHash.reversed.toList());

    return (rawTxHex: rawTxHex, txid: txid);
  }

  /// Converts a Bitcoin address (SegWit tb1/bc1 or legacy) to scriptPubKey.
  static Uint8List addressToScriptPubKey(String address) {
    final trimmed = address.trim();
    if (trimmed.toLowerCase().startsWith('bc1') ||
        trimmed.toLowerCase().startsWith('tb1')) {
      final decoded = HdDerivation.segwitDecode(trimmed);
      if (decoded.witver == 0 && decoded.witprog.length == 20) {
        // P2WPKH: 0x00 0x14 <20 bytes>
        return Uint8List.fromList([0x00, 0x14, ...decoded.witprog]);
      } else if (decoded.witver == 0 && decoded.witprog.length == 32) {
        // P2WSH: 0x00 0x20 <32 bytes>
        return Uint8List.fromList([0x00, 0x20, ...decoded.witprog]);
      }
      throw FormatException('Unsupported SegWit witness version or program length');
    }

    // Legacy Base58Check address (P2PKH: 1/m/n, P2SH: 3/2)
    final payload = HdDerivation.base58CheckDecode(trimmed);
    final version = payload[0];
    final hash = payload.sublist(1);

    if (version == 0x00 || version == 0x6f) {
      // P2PKH: OP_DUP OP_HASH160 <20 bytes> OP_EQUALVERIFY OP_CHECKSIG
      return Uint8List.fromList([0x76, 0xa9, 0x14, ...hash, 0x88, 0xac]);
    } else if (version == 0x05 || version == 0xc4) {
      // P2SH: OP_HASH160 <20 bytes> OP_EQUAL
      return Uint8List.fromList([0xa9, 0x14, ...hash, 0x87]);
    }

    throw FormatException('Unrecognized Bitcoin address format: $address');
  }

  // --- Low-level cryptographic helpers ---

  static Uint8List _doubleSha256(Uint8List data) {
    final first = crypto.sha256.convert(data).bytes;
    return Uint8List.fromList(crypto.sha256.convert(first).bytes);
  }

  static Uint8List _hash160(Uint8List data) {
    final sha = crypto.sha256.convert(data).bytes;
    final ripe = RIPEMD160Digest();
    ripe.update(Uint8List.fromList(sha), 0, sha.length);
    final out = Uint8List(20);
    ripe.doFinal(out, 0);
    return out;
  }

  static Uint8List _hexToBytesReversed(String hexStr) {
    final bytes = hex.decode(hexStr.padLeft(64, '0'));
    return Uint8List.fromList(bytes.reversed.toList());
  }

  static Uint8List _varInt(int value) {
    if (value < 0xfd) {
      return Uint8List.fromList([value]);
    } else if (value <= 0xffff) {
      final b = ByteData(3);
      b.setUint8(0, 0xfd);
      b.setUint16(1, value, Endian.little);
      return b.buffer.asUint8List();
    } else if (value <= 0xffffffff) {
      final b = ByteData(5);
      b.setUint8(0, 0xfe);
      b.setUint32(1, value, Endian.little);
      return b.buffer.asUint8List();
    } else {
      final b = ByteData(9);
      b.setUint8(0, 0xff);
      b.setUint64(1, value, Endian.little);
      return b.buffer.asUint8List();
    }
  }

  /// Signs message digest with secp256k1 private key using RFC 6979 deterministic nonce.
  /// Enforces low-s and returns canonical DER-encoded signature.
  static Uint8List _signSecp256k1(Uint8List digest, Uint8List privateKey) {
    final domain = ECDomainParameters('secp256k1');
    final privKeyBigInt = BigInt.parse(hex.encode(privateKey), radix: 16);
    final key = ECPrivateKey(privKeyBigInt, domain);

    final signer = ECDSASigner(null, HMac(SHA256Digest(), 64));
    signer.init(true, PrivateKeyParameter(key));

    var sig = signer.generateSignature(digest) as ECSignature;

    // Enforce low-s (BIP 62 / BIP 143)
    final halfOrder = domain.n >> 1;
    var s = sig.s;
    if (s > halfOrder) {
      s = domain.n - s;
    }

    return _derEncode(sig.r, s);
  }

  static Uint8List _derEncode(BigInt r, BigInt s) {
    List<int> encodeInt(BigInt value) {
      var bytes = hex.decode(value.toRadixString(16).padLeft((value.bitLength + 7) ~/ 8 * 2, '0'));
      if (bytes.isEmpty) bytes = [0];
      if ((bytes[0] & 0x80) != 0) {
        bytes = [0x00, ...bytes];
      }
      return [0x02, bytes.length, ...bytes];
    }

    final rBytes = encodeInt(r);
    final sBytes = encodeInt(s);
    final totalLen = rBytes.length + sBytes.length;

    return Uint8List.fromList([
      0x30,
      totalLen,
      ...rBytes,
      ...sBytes,
    ]);
  }
}
