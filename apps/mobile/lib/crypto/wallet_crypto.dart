import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:bip39/bip39.dart' as bip39;
// ignore: implementation_imports
import 'package:bip39/src/wordlists/english.dart' show WORDLIST;
import 'package:convert/convert.dart';
import 'package:crypto/crypto.dart';

import '../portfolio/models.dart';
import '../release/release_config.dart';
import 'hd_derivation.dart';

/// On-device wallet cryptography.
/// Recovery phrase is BIP39. Private material never leaves the device.
class WalletCrypto {
  WalletCrypto._();

  /// BIP-39 mnemonic from CSPRNG entropy (each byte 0–255). Does not use the
  /// upstream helper that called `Random.nextInt(255)` and never produced `0xFF`.
  static String generateMnemonic({int strength = 128}) {
    if (strength % 32 != 0 || strength < 128 || strength > 256) {
      throw ArgumentError('BIP-39 strength must be 128–256 and divisible by 32.');
    }
    final rng = Random.secure();
    final bytes = Uint8List(strength ~/ 8);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = rng.nextInt(256);
    }
    return bip39.entropyToMnemonic(hex.encode(bytes));
  }

  static bool validateMnemonic(String phrase) {
    final normalized = normalizeMnemonic(phrase);
    if (normalized.isEmpty) return false;
    return bip39.validateMnemonic(normalized);
  }

  /// Trim, lowercase, collapse whitespace, strip zero-width / NBSP.
  /// Does **not** translate words — BIP-39 English wordlist stays English.
  static String normalizeMnemonic(String phrase) {
    var s = phrase.replaceAll(RegExp(r'[\u200B-\u200D\uFEFF]'), '');
    s = s.replaceAll(RegExp(r'[\u00A0\u202F]'), ' ');
    return s.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
  }

  /// Why a phrase failed — never includes the phrase itself.
  static MnemonicIssue diagnoseMnemonic(String phrase) {
    final normalized = normalizeMnemonic(phrase);
    if (normalized.isEmpty) return MnemonicIssue.empty;
    final parts = normalized.split(' ');
    if (parts.length != 12 && parts.length != 24) return MnemonicIssue.badCount;
    if (bip39.validateMnemonic(normalized)) return MnemonicIssue.none;
    for (final word in parts) {
      if (!_bip39English.contains(word)) return MnemonicIssue.unknownWord;
    }
    return MnemonicIssue.checksum;
  }

  static String issueMessage(MnemonicIssue issue) {
    return switch (issue) {
      MnemonicIssue.none => '',
      MnemonicIssue.empty => 'Enter your recovery phrase.',
      MnemonicIssue.badCount => 'Use a 12- or 24-word recovery phrase.',
      MnemonicIssue.unknownWord =>
        'One or more words are not on the BIP-39 English word list. Check spelling — app language does not change these words.',
      MnemonicIssue.checksum =>
        'That phrase isn’t valid. Check each word and the order carefully.',
    };
  }

  static final Set<String> _bip39English = WORDLIST.toSet();

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

  static List<int> pickQuizIndices(int wordCount, {int quizSize = 3, Random? random}) {
    final rng = random ?? Random.secure();
    final indices = <int>{};
    while (indices.length < quizSize && indices.length < wordCount) {
      indices.add(rng.nextInt(wordCount));
    }
    final list = indices.toList()..sort();
    return list;
  }

  /// Correct word plus distractors from the BIP-39 English list (never the
  /// same string twice, never another word copied from this phrase).
  static List<String> quizChoices(
    List<String> allWords,
    int targetIndex, {
    int distractors = 2,
    Random? random,
  }) {
    final rng = random ?? Random.secure();
    final correct = allWords[targetIndex];
    final banned = allWords.toSet();
    final pool = [
      for (final w in WORDLIST)
        if (!banned.contains(w)) w,
    ];
    pool.shuffle(rng);
    final extras = <String>[];
    for (final w in pool) {
      extras.add(w);
      if (extras.length >= distractors) break;
    }
    final choices = <String>[correct, ...extras];
    choices.shuffle(rng);
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

enum MnemonicIssue { none, empty, badCount, unknownWord, checksum }
