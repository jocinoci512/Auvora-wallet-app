import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:bip39/bip39.dart' as bip39;
import 'package:convert/convert.dart';
import 'package:crypto/crypto.dart';

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

  /// Deterministic display fingerprint until Sprint 2 chain derivation.
  static String fingerprintAddress(String mnemonic) {
    final seed = bip39.mnemonicToSeed(normalizeMnemonic(mnemonic));
    final digest = sha256.convert(seed);
    final bytes = digest.bytes.take(20).toList();
    return '0x${hex.encode(bytes)}';
  }

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

  static String pinPepperHash(String pin, String salt) {
    final bytes = utf8.encode('$salt::$pin::auvora');
    return sha256.convert(bytes).toString();
  }

  static String newSalt() {
    final rng = Random.secure();
    final data = Uint8List.fromList(List.generate(16, (_) => rng.nextInt(256)));
    return hex.encode(data);
  }
}
