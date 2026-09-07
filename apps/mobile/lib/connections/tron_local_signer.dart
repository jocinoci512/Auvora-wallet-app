/// Local Tron (BIP-44) transaction assembly, canonical protobuf serialization, and signing.
///
/// Keys stay on-device. Private keys are never logged or transmitted.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:convert/convert.dart';
import 'package:crypto/crypto.dart' as crypto;
import 'package:web3dart/crypto.dart' as web3_crypto;

import '../crypto/hd_derivation.dart';
import '../portfolio/models.dart';

class TronTransactionData {
  const TronTransactionData({
    required this.refBlockBytes,
    required this.refBlockHash,
    required this.expirationMs,
    required this.timestampMs,
    required this.ownerAddressHex,
    required this.toAddressHex,
    required this.amountSun,
    this.contractAddressHex,
    this.feeLimitSun,
  });

  final String refBlockBytes;
  final String refBlockHash;
  final int expirationMs;
  final int timestampMs;
  final String ownerAddressHex;
  final String toAddressHex;
  final int amountSun;
  final String? contractAddressHex;
  final int? feeLimitSun;

  bool get isTrc20 => contractAddressHex != null && contractAddressHex!.isNotEmpty;
}

class TronLocalSigner {
  const TronLocalSigner();

  /// 1 TRX = 1,000,000 SUN
  static const int sunPerTrx = 1000000;

  /// Standard bandwidth estimation for native TRX transfer.
  static const int standardTransferBandwidth = 267;

  /// Sun burn rate per bandwidth point when account has no free bandwidth.
  static const int sunPerBandwidthPoint = 1000;

  /// Default fee in TRX if bandwidth is burned.
  static double estimateTrxFee({bool hasBandwidth = false}) {
    if (hasBandwidth) return 0.0;
    return (standardTransferBandwidth * sunPerBandwidthPoint) / sunPerTrx;
  }

  String addressFromMnemonic(String mnemonic, {int accountIndex = 0}) {
    return HdDerivation.deriveAddress(
      mnemonic: mnemonic,
      network: AssetNetwork.tron,
      accountIndex: accountIndex,
    );
  }

  /// Convert Tron T... address to 21-byte hex (starts with 41).
  static String addressToHex(String address) {
    final payload = HdDerivation.base58CheckDecode(address.trim());
    if (payload.length != 21 || payload[0] != 0x41) {
      throw FormatException('Invalid Tron address: $address');
    }
    return hex.encode(payload);
  }

  /// Convert 21-byte hex (starts with 41) to Tron Base58Check address (T...).
  static String hexToAddress(String hexStr) {
    final clean = hexStr.startsWith('0x') ? hexStr.substring(2) : hexStr;
    final bytes = Uint8List.fromList(hex.decode(clean));
    return HdDerivation.base58CheckEncode(bytes);
  }

  /// Assembles and canonically serializes the Tron Transaction.raw_data protobuf.
  static Uint8List serializeRawData(TronTransactionData tx) {
    final bb = BytesBuilder();

    // 1. ref_block_bytes: tag = (1 << 3) | 2 = 0x0a
    final blockBytes = hex.decode(tx.refBlockBytes.padLeft(4, '0'));
    bb.addByte(0x0a);
    bb.addByte(blockBytes.length);
    bb.add(blockBytes);

    // 4. ref_block_hash: tag = (4 << 3) | 2 = 0x22
    final blockHash = hex.decode(tx.refBlockHash.padLeft(16, '0'));
    bb.addByte(0x22);
    bb.addByte(blockHash.length);
    bb.add(blockHash);

    // 8. expiration: tag = (8 << 3) | 0 = 0x40
    bb.addByte(0x40);
    bb.add(_encodeVarInt(tx.expirationMs));

    // 11. contract: tag = (11 << 3) | 2 = 0x5a
    final contractBytes = _serializeContract(tx);
    bb.addByte(0x5a);
    bb.add(_encodeVarInt(contractBytes.length));
    bb.add(contractBytes);

    // 14. timestamp: tag = (14 << 3) | 0 = 0x70
    bb.addByte(0x70);
    bb.add(_encodeVarInt(tx.timestampMs));

    // 18. fee_limit (if TRC-20): tag = (18 << 3) | 0 = 0x90 0x01
    if (tx.feeLimitSun != null && tx.feeLimitSun! > 0) {
      bb.addByte(0x90);
      bb.addByte(0x01);
      bb.add(_encodeVarInt(tx.feeLimitSun!));
    }

    return bb.toBytes();
  }

  static Uint8List _serializeContract(TronTransactionData tx) {
    final bb = BytesBuilder();

    if (!tx.isTrc20) {
      // TransferContract: type = 1
      // Field 1: type enum = 1 -> tag (1 << 3) | 0 = 0x08
      bb.addByte(0x08);
      bb.addByte(0x01);

      // Field 2: parameter (google.protobuf.Any) -> tag (2 << 3) | 2 = 0x12
      final paramBb = BytesBuilder();
      const typeUrl = 'type.googleapis.com/protocol.TransferContract';
      final typeUrlBytes = utf8.encode(typeUrl);
      paramBb.addByte(0x0a);
      paramBb.add(_encodeVarInt(typeUrlBytes.length));
      paramBb.add(typeUrlBytes);

      // Value: TransferContract message
      final valBb = BytesBuilder();
      final owner = hex.decode(tx.ownerAddressHex);
      valBb.addByte(0x0a);
      valBb.addByte(owner.length);
      valBb.add(owner);

      final to = hex.decode(tx.toAddressHex);
      valBb.addByte(0x12);
      valBb.addByte(to.length);
      valBb.add(to);

      valBb.addByte(0x18);
      valBb.add(_encodeVarInt(tx.amountSun));

      final valBytes = valBb.toBytes();
      paramBb.addByte(0x12);
      paramBb.add(_encodeVarInt(valBytes.length));
      paramBb.add(valBytes);

      final paramBytes = paramBb.toBytes();
      bb.addByte(0x12);
      bb.add(_encodeVarInt(paramBytes.length));
      bb.add(paramBytes);
    } else {
      // TriggerSmartContract: type = 31 (SmartContract)
      bb.addByte(0x08);
      bb.addByte(31);

      final paramBb = BytesBuilder();
      const typeUrl = 'type.googleapis.com/protocol.TriggerSmartContract';
      final typeUrlBytes = utf8.encode(typeUrl);
      paramBb.addByte(0x0a);
      paramBb.add(_encodeVarInt(typeUrlBytes.length));
      paramBb.add(typeUrlBytes);

      final valBb = BytesBuilder();
      final owner = hex.decode(tx.ownerAddressHex);
      valBb.addByte(0x0a);
      valBb.addByte(owner.length);
      valBb.add(owner);

      final contract = hex.decode(tx.contractAddressHex!);
      valBb.addByte(0x12);
      valBb.addByte(contract.length);
      valBb.add(contract);

      // Calldata for transfer(address,uint256): selector a9059cbb + 32-byte address + 32-byte amount
      final toAddr20 = tx.toAddressHex.length == 42
          ? tx.toAddressHex.substring(2)
          : tx.toAddressHex;
      final calldataHex = 'a9059cbb' +
          toAddr20.padLeft(64, '0') +
          BigInt.from(tx.amountSun).toRadixString(16).padLeft(64, '0');
      final dataBytes = hex.decode(calldataHex);
      valBb.addByte(0x22);
      valBb.add(_encodeVarInt(dataBytes.length));
      valBb.add(dataBytes);

      final valBytes = valBb.toBytes();
      paramBb.addByte(0x12);
      paramBb.add(_encodeVarInt(valBytes.length));
      paramBb.add(valBytes);

      final paramBytes = paramBb.toBytes();
      bb.addByte(0x12);
      bb.add(_encodeVarInt(paramBytes.length));
      bb.add(paramBytes);
    }

    return bb.toBytes();
  }

  /// Sign a Tron transaction client-side.
  /// Returns txID (SHA256 hex of raw_data), raw_data_hex, and signature list.
  Map<String, dynamic> signTransaction({
    required String mnemonic,
    required TronTransactionData txData,
    int accountIndex = 0,
  }) {
    final privateKey = HdDerivation.deriveTronPrivateKey(
      mnemonic: mnemonic,
      accountIndex: accountIndex,
    );

    final rawDataBytes = serializeRawData(txData);
    final rawDataHex = hex.encode(rawDataBytes);

    // txID is the SHA256 of raw_data
    final txHash = Uint8List.fromList(crypto.sha256.convert(rawDataBytes).bytes);
    final txId = hex.encode(txHash);

    // secp256k1 sign with recovery id (RFC 6979)
    final signatureHex = _signSecp256k1WithRecovery(txHash, privateKey);

    return {
      'txID': txId,
      'raw_data': {
        'contract': [
          {
            'parameter': {
              'value': {
                'amount': txData.amountSun,
                'owner_address': txData.ownerAddressHex,
                'to_address': txData.toAddressHex,
              },
              'type_url': txData.isTrc20
                  ? 'type.googleapis.com/protocol.TriggerSmartContract'
                  : 'type.googleapis.com/protocol.TransferContract',
            },
            'type': txData.isTrc20 ? 'TriggerSmartContract' : 'TransferContract',
          }
        ],
        'ref_block_bytes': txData.refBlockBytes,
        'ref_block_hash': txData.refBlockHash,
        'expiration': txData.expirationMs,
        'timestamp': txData.timestampMs,
        if (txData.feeLimitSun != null) 'fee_limit': txData.feeLimitSun,
      },
      'raw_data_hex': rawDataHex,
      'signature': [signatureHex],
    };
  }

  static String _signSecp256k1WithRecovery(Uint8List hash, Uint8List privateKey) {
    final sig = web3_crypto.sign(hash, privateKey);
    final recId = sig.v >= 27 ? sig.v - 27 : sig.v;
    final rBytes = _bigIntTo32(sig.r);
    final sBytes = _bigIntTo32(sig.s);
    final fullSig = Uint8List.fromList([...rBytes, ...sBytes, recId]);
    return hex.encode(fullSig);
  }

  static Uint8List _bigIntTo32(BigInt val) {
    final h = val.toRadixString(16).padLeft(64, '0');
    return Uint8List.fromList(hex.decode(h));
  }

  static List<int> _encodeVarInt(int value) {
    final bytes = <int>[];
    var v = value;
    while (v > 0x7f) {
      bytes.add((v & 0x7f) | 0x80);
      v >>= 7;
    }
    bytes.add(v & 0x7f);
    return bytes;
  }
}
