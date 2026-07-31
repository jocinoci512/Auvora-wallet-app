import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:bip39/bip39.dart' as bip39;
import 'package:convert/convert.dart';
import 'package:crypto/crypto.dart';

import '../portfolio/models.dart';
import '../release/release_config.dart';
import 'hd_derivation.dart';

/// On-device wallet cryptography.
/// Recovery phrase is BIP39. Private material never leaves the device.
class WalletCrypto {
  WalletCrypto._();

  static String generateMnemonic({int strength = 128}) {
    return bip39.generateMnemonic(strength: strength);
  }

  static bool validateMnemonic(String phrase) {
    final normalized = phrase.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
    if (normalized.isEmpty) return false;
    return bip39.validateMnemonic(normalized);
  }

  static String normalizeMnemonic(String phrase) {
    return phrase.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
  }

  /// Deterministic ETH-style fingerprint for display / legacy callers.
  static String fingerprintAddress(String mnemonic) {
    return deriveAddressForNetwork(normalizeMnemonic(mnemonic), AssetNetwork.ethereum);
  }

  /// Derive a receive address for [network].
  ///
  /// Uses BIP32 / SLIP-0010 when [ReleaseConfig.derivationMode] is
  /// [DerivationMode.bip32Partial] or [DerivationMode.production].
  /// Falls back to the Closed Beta preview SHA scheme only for `previewSha`.
  static String deriveAddressForNetwork(String mnemonic, AssetNetwork network, {int index = 0}) {
    final normalized = normalizeMnemonic(mnemonic);
    if (ReleaseConfig.derivationMode != DerivationMode.previewSha) {
      return HdDerivation.deriveAddress(
        mnemonic: normalized,
        network: network,
        accountIndex: index,
      );
    }
    final seed = bip39.mnemonicToSeed(normalized);
    final material = sha256
        .convert(utf8.encode('${hex.encode(seed)}::${network.name}::$index::auvora'))
        .bytes;
    switch (network) {
      case AssetNetwork.ethereum:
      case AssetNetwork.polygon:
      case AssetNetwork.bnbSmartChain:
        return '0x${hex.encode(material.take(20).toList())}';
      case AssetNetwork.bitcoin:
        return 'bc1${hex.encode(material.take(19).toList())}';
      case AssetNetwork.solana:
        return _base58(material.take(32).toList());
      case AssetNetwork.tron:
        return 'T${_base58(material.take(24).toList())}';
    }
  }

  static String derivationPathFor(AssetNetwork network, {int accountIndex = 0}) =>
      HdDerivation.derivationPath(network, accountIndex: accountIndex);

  static List<String> words(String mnemonic) => normalizeMnemonic(mnemonic).split(' ');

  static List<int> pickQuizIndices(int wordCount, {int quizSize = 3}) {
    final rng = Random.secure();
    final indices = <int>{};
    while (indices.length < quizSize && indices.length < wordCount) {
      indices.add(rng.nextInt(wordCount));
    }
    final list = indices.toList()..sort();
    return list;
  }

  /// Correct word plus two distractors from the same phrase (shuffled).
  static List<String> quizChoices(List<String> allWords, int targetIndex) {
    final correct = allWords[targetIndex];
    final pool = <String>{
      for (var i = 0; i < allWords.length; i++)
        if (i != targetIndex) allWords[i],
    }.toList();
    pool.shuffle(Random.secure());
    final choices = <String>[correct, ...pool.take(2)];
    choices.shuffle(Random.secure());
    return choices;
  }

  /// Slow iterated hash for device PIN (v2). Legacy single-pass still verifies.
  /// Replace with Argon2id before public beta when a native KDF is wired.
  static String pinPepperHash(String pin, String salt) {
    var digest = sha256.convert(utf8.encode('auvora-pin-v2|$salt|$pin'));
    for (var i = 0; i < 100000; i++) {
      digest = sha256.convert(digest.bytes);
    }
    return 'v2:${digest.toString()}';
  }

  static bool verifyPinHash(String pin, String salt, String stored) {
    final String candidate;
    if (stored.startsWith('v2:')) {
      candidate = pinPepperHash(pin, salt);
    } else if (stored.startsWith('v3:')) {
      // Reserved for Argon2id migration — fall through to reject until wired.
      return false;
    } else {
      candidate = sha256.convert(utf8.encode('$salt::$pin::auvora')).toString();
    }
    return _constantTimeEquals(candidate, stored);
  }

  /// Constant-time string compare to reduce PIN timing leakage.
  static bool _constantTimeEquals(String a, String b) {
    if (a.length != b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return diff == 0;
  }

  static String newSalt() {
    final rng = Random.secure();
    final data = Uint8List.fromList(List.generate(16, (_) => rng.nextInt(256)));
    return hex.encode(data);
  }

  static String compactAddress(String value) {
    if (value.length <= 14) return value;
    return '${value.substring(0, 8)}…${value.substring(value.length - 4)}';
  }

  static String shortHash(String input) {
    final digest = sha256.convert(utf8.encode(input)).bytes;
    if (input.startsWith('T')) return 'T${_base58(digest.take(20).toList())}';
    return '0x${hex.encode(digest.take(20).toList())}';
  }

  static String _base58(List<int> bytes) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var value = BigInt.zero;
    for (final byte in bytes) {
      value = (value << 8) | BigInt.from(byte);
    }
    final out = StringBuffer();
    while (value > BigInt.zero) {
      final mod = value.remainder(BigInt.from(58)).toInt();
      out.write(alphabet[mod]);
      value = value ~/ BigInt.from(58);
    }
    final prefixZeros = bytes.takeWhile((byte) => byte == 0).length;
    for (var i = 0; i < prefixZeros; i++) {
      out.write(alphabet[0]);
    }
    final text = out.toString().split('').reversed.join();
    return text.isEmpty ? alphabet[0] : text;
  }
}
