import 'dart:convert';

import 'package:bip39/bip39.dart' as bip39;
import 'package:convert/convert.dart';
import 'package:crypto/crypto.dart' as crypto;
import 'package:pinenacl/ed25519.dart';
import 'package:pointycastle/export.dart';

import '../portfolio/models.dart';

/// BIP32 / SLIP-0010 HD derivation for supported Auvora chains.
///
/// Paths:
/// - Bitcoin native SegWit: m/84'/0'/account'/0/0
/// - Ethereum / BNB / Polygon: m/44'/60'/account'/0/0
/// - Solana: m/44'/501'/account'/0'
/// - Tron: m/44'/195'/account'/0/0
class HdDerivation {
  HdDerivation._();

  static const _base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  static const _bech32Charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  static final _curveOrder = BigInt.parse(
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141',
    radix: 16,
  );

  static Uint8List seedFromMnemonic(String mnemonic, {String passphrase = ''}) {
    return Uint8List.fromList(bip39.mnemonicToSeed(mnemonic, passphrase: passphrase));
  }

  /// EVM account private key (m/44'/60'/account'/0/0). Caller must not log or export.
  static Uint8List deriveEvmPrivateKey({
    required String mnemonic,
    int accountIndex = 0,
    String passphrase = '',
  }) {
    final seed = seedFromMnemonic(mnemonic, passphrase: passphrase);
    final node = _deriveSecpPath(seed, "m/44'/60'/$accountIndex'/0/0");
    return Uint8List.fromList(node.privateKey);
  }

  static String deriveAddress({
    required String mnemonic,
    required AssetNetwork network,
    int accountIndex = 0,
    String passphrase = '',
  }) {
    final seed = seedFromMnemonic(mnemonic, passphrase: passphrase);
    switch (network) {
      case AssetNetwork.ethereum:
      case AssetNetwork.bnbSmartChain:
      case AssetNetwork.polygon:
        final node = _deriveSecpPath(seed, "m/44'/60'/$accountIndex'/0/0");
        return _ethereumAddress(node.privateKey);
      case AssetNetwork.bitcoin:
        final node = _deriveSecpPath(seed, "m/84'/0'/$accountIndex'/0/0");
        return _bitcoinBech32Address(node.privateKey);
      case AssetNetwork.tron:
        final node = _deriveSecpPath(seed, "m/44'/195'/$accountIndex'/0/0");
        return _tronAddress(node.privateKey);
      case AssetNetwork.solana:
        return _solanaAddress(seed, accountIndex);
    }
  }

  static String derivationPath(AssetNetwork network, {int accountIndex = 0}) {
    return switch (network) {
      AssetNetwork.bitcoin => "m/84'/0'/$accountIndex'/0/0",
      AssetNetwork.ethereum || AssetNetwork.bnbSmartChain || AssetNetwork.polygon =>
        "m/44'/60'/$accountIndex'/0/0",
      AssetNetwork.solana => "m/44'/501'/$accountIndex'/0'",
      AssetNetwork.tron => "m/44'/195'/$accountIndex'/0/0",
    };
  }

  static _SecpNode _deriveSecpPath(Uint8List seed, String path) {
    var node = _SecpNode.fromSeed(seed);
    final parts = path.replaceFirst('m/', '').split('/');
    for (final part in parts) {
      final hardened = part.endsWith("'");
      final index = int.parse(hardened ? part.substring(0, part.length - 1) : part);
      node = node.deriveChild(hardened ? (index + 0x80000000) : index);
    }
    return node;
  }

  static String _solanaAddress(Uint8List seed, int accountIndex) {
    // SLIP-0010 ed25519 master + hardened path m/44'/501'/account'/0'
    var node = _Slip10Node.fromSeed(seed);
    for (final index in [44, 501, accountIndex, 0]) {
      node = node.deriveHardened(index);
    }
    final signingKey = SigningKey.fromSeed(node.key);
    return _base58Encode(Uint8List.fromList(signingKey.publicKey));
  }

  static String _ethereumAddress(Uint8List privateKey) {
    final pub = _uncompressedPublicKey(privateKey);
    final keccak = KeccakDigest(256);
    keccak.update(pub, 1, 64);
    final hash = Uint8List(32);
    keccak.doFinal(hash, 0);
    return '0x${hex.encode(hash.sublist(12))}';
  }

  static String _tronAddress(Uint8List privateKey) {
    final pub = _uncompressedPublicKey(privateKey);
    final keccak = KeccakDigest(256);
    keccak.update(pub, 1, 64);
    final hash = Uint8List(32);
    keccak.doFinal(hash, 0);
    final payload = Uint8List.fromList([0x41, ...hash.sublist(12)]);
    return _base58Check(payload);
  }

  static String _bitcoinBech32Address(Uint8List privateKey) {
    final compressed = _compressedPublicKey(privateKey);
    final sha = crypto.sha256.convert(compressed).bytes;
    final ripe = RIPEMD160Digest();
    ripe.update(Uint8List.fromList(sha), 0, sha.length);
    final program = Uint8List(20);
    ripe.doFinal(program, 0);
    return _segwitEncode(hrp: 'bc', witver: 0, witprog: program);
  }

  static Uint8List _uncompressedPublicKey(Uint8List privateKey) {
    final domain = ECDomainParameters('secp256k1');
    final q = domain.G * _bytesToBigInt(privateKey);
    if (q == null) throw StateError('Failed to derive secp256k1 public key.');
    return q.getEncoded(false);
  }

  static Uint8List _compressedPublicKey(Uint8List privateKey) {
    final domain = ECDomainParameters('secp256k1');
    final q = domain.G * _bytesToBigInt(privateKey);
    if (q == null) throw StateError('Failed to derive secp256k1 public key.');
    return q.getEncoded(true);
  }

  static BigInt _bytesToBigInt(Uint8List bytes) => BigInt.parse(hex.encode(bytes), radix: 16);

  static Uint8List _bigIntTo32(BigInt value) {
    final hexStr = value.toRadixString(16).padLeft(64, '0');
    return Uint8List.fromList(hex.decode(hexStr));
  }

  static String _base58Encode(Uint8List bytes) {
    var value = BigInt.zero;
    for (final byte in bytes) {
      value = (value << 8) | BigInt.from(byte);
    }
    final out = StringBuffer();
    while (value > BigInt.zero) {
      final mod = value.remainder(BigInt.from(58)).toInt();
      out.write(_base58Alphabet[mod]);
      value = value ~/ BigInt.from(58);
    }
    for (final byte in bytes) {
      if (byte != 0) break;
      out.write(_base58Alphabet[0]);
    }
    return out.toString().split('').reversed.join();
  }

  static String _base58Check(Uint8List payload) {
    final checksum = crypto.sha256.convert(crypto.sha256.convert(payload).bytes).bytes.take(4);
    return _base58Encode(Uint8List.fromList([...payload, ...checksum]));
  }

  static String _segwitEncode({
    required String hrp,
    required int witver,
    required Uint8List witprog,
  }) {
    final values = <int>[witver, ..._convertBits(witprog, 8, 5, true)];
    final checksum = _bech32CreateChecksum(hrp, values);
    final body = [...values, ...checksum].map((v) => _bech32Charset[v]).join();
    return '$hrp${'1'}$body';
  }

  static List<int> _convertBits(List<int> data, int from, int to, bool pad) {
    var acc = 0;
    var bits = 0;
    final maxv = (1 << to) - 1;
    final out = <int>[];
    for (final value in data) {
      if (value < 0 || value >> from != 0) {
        throw ArgumentError('Invalid convertBits input');
      }
      acc = (acc << from) | value;
      bits += from;
      while (bits >= to) {
        bits -= to;
        out.add((acc >> bits) & maxv);
      }
    }
    if (pad && bits > 0) out.add((acc << (to - bits)) & maxv);
    return out;
  }

  static List<int> _bech32CreateChecksum(String hrp, List<int> values) {
    final polymod = _bech32Polymod([..._bech32HrpExpand(hrp), ...values, 0, 0, 0, 0, 0, 0]) ^ 1;
    return [for (var i = 0; i < 6; i++) (polymod >> (5 * (5 - i))) & 31];
  }

  static List<int> _bech32HrpExpand(String hrp) => [
        for (final c in hrp.codeUnits) c >> 5,
        0,
        for (final c in hrp.codeUnits) c & 31,
      ];

  static int _bech32Polymod(List<int> values) {
    const gen = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    var chk = 1;
    for (final v in values) {
      final b = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (var i = 0; i < 5; i++) {
        if (((b >> i) & 1) != 0) chk ^= gen[i];
      }
    }
    return chk;
  }
}

class _SecpNode {
  _SecpNode(this.privateKey, this.chainCode);

  final Uint8List privateKey;
  final Uint8List chainCode;

  factory _SecpNode.fromSeed(Uint8List seed) {
    final hmac = HMac(SHA512Digest(), 64)
      ..init(KeyParameter(Uint8List.fromList(utf8.encode('Bitcoin seed'))));
    hmac.update(seed, 0, seed.length);
    final out = Uint8List(64);
    hmac.doFinal(out, 0);
    return _SecpNode(out.sublist(0, 32), out.sublist(32));
  }

  _SecpNode deriveChild(int index) {
    final data = Uint8List(37);
    if (index >= 0x80000000) {
      data[0] = 0;
      data.setRange(1, 33, privateKey);
    } else {
      data.setRange(0, 33, HdDerivation._compressedPublicKey(privateKey));
    }
    data[33] = (index >> 24) & 0xff;
    data[34] = (index >> 16) & 0xff;
    data[35] = (index >> 8) & 0xff;
    data[36] = index & 0xff;

    final hmac = HMac(SHA512Digest(), 64)..init(KeyParameter(chainCode));
    hmac.update(data, 0, data.length);
    final out = Uint8List(64);
    hmac.doFinal(out, 0);

    final il = HdDerivation._bytesToBigInt(out.sublist(0, 32));
    final childKey = (il + HdDerivation._bytesToBigInt(privateKey)) % HdDerivation._curveOrder;
    if (il >= HdDerivation._curveOrder || childKey == BigInt.zero) {
      return deriveChild(index + 1);
    }
    return _SecpNode(HdDerivation._bigIntTo32(childKey), out.sublist(32));
  }
}

class _Slip10Node {
  _Slip10Node(this.key, this.chainCode);

  final Uint8List key;
  final Uint8List chainCode;

  factory _Slip10Node.fromSeed(Uint8List seed) {
    final mac = crypto.Hmac(crypto.sha512, utf8.encode('ed25519 seed')).convert(seed);
    return _Slip10Node(
      Uint8List.fromList(mac.bytes.sublist(0, 32)),
      Uint8List.fromList(mac.bytes.sublist(32)),
    );
  }

  _Slip10Node deriveHardened(int index) {
    final data = Uint8List(37);
    data[0] = 0;
    data.setRange(1, 33, key);
    final hardened = index + 0x80000000;
    data[33] = (hardened >> 24) & 0xff;
    data[34] = (hardened >> 16) & 0xff;
    data[35] = (hardened >> 8) & 0xff;
    data[36] = hardened & 0xff;
    final mac = crypto.Hmac(crypto.sha512, chainCode).convert(data);
    return _Slip10Node(
      Uint8List.fromList(mac.bytes.sublist(0, 32)),
      Uint8List.fromList(mac.bytes.sublist(32)),
    );
  }
}
