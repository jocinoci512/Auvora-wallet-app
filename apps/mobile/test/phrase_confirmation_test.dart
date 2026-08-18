import 'dart:math';

import 'package:auvora_wallet/crypto/phrase_confirmation.dart';
import 'package:auvora_wallet/crypto/wallet_crypto.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const fixture =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  test('wrong word does not complete confirmation and does not advance', () {
    final rng = Random(7);
    final session = PhraseConfirmationSession.fromMnemonic(fixture, random: rng);
    final index = session.currentIndex;
    final wrong = session.currentChoices.firstWhere((w) => w != session.words[index]);
    expect(session.select(wrong), isFalse);
    expect(session.complete, isFalse);
    expect(session.cursor, 0);
    expect(session.error, PhraseConfirmationSession.wrongWordMessage);
    expect(session.advanceIfCurrentCorrect(), isFalse);
    expect(session.cursor, 0);
  });

  test('only the word at the asked position can complete the quiz', () {
    final rng = Random(11);
    final session = PhraseConfirmationSession.fromMnemonic(fixture, random: rng);
    while (!session.complete) {
      final index = session.currentIndex;
      final correct = session.words[index];
      expect(session.currentChoices, contains(correct));
      expect(session.select(correct), isTrue);
      session.advanceIfCurrentCorrect();
    }
    expect(session.complete, isTrue);
  });

  test('quiz distractors are unique and not copied from the phrase', () {
    final words = WalletCrypto.words(fixture);
    final rng = Random(3);
    final choices = WalletCrypto.quizChoices(words, 0, random: rng);
    expect(choices.toSet().length, choices.length);
    expect(choices, contains(words[0]));
    final extras = choices.where((w) => w != words[0]);
    for (final extra in extras) {
      expect(words.contains(extra), isFalse);
    }
  });

  test('BIP39 checksum and unknown words are rejected', () {
    expect(WalletCrypto.validateMnemonic(fixture), isTrue);
    expect(WalletCrypto.diagnoseMnemonic(fixture), MnemonicIssue.none);
    final swapped = 'about abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    expect(WalletCrypto.diagnoseMnemonic(swapped), MnemonicIssue.checksum);
    expect(WalletCrypto.diagnoseMnemonic('zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz'),
        MnemonicIssue.unknownWord);
    expect(WalletCrypto.diagnoseMnemonic('one two'), MnemonicIssue.badCount);
  });

  test('wrong tap after a correct tap cannot finish the current step', () {
    final rng = Random(19);
    final session = PhraseConfirmationSession.fromMnemonic(fixture, random: rng);
    final index = session.currentIndex;
    final correct = session.words[index];
    final wrong = session.currentChoices.firstWhere((w) => w != correct);
    expect(session.select(correct), isTrue);
    expect(session.select(wrong), isFalse);
    expect(session.answers.containsKey(index), isFalse);
    expect(session.complete, isFalse);
    expect(session.advanceIfCurrentCorrect(), isFalse);
  });

  test('invalid mnemonic cannot start a confirmation session', () {
    expect(
      () => PhraseConfirmationSession.fromMnemonic('not a real phrase here at all really now'),
      throwsArgumentError,
    );
  });

  test('generated mnemonics validate and use full-byte entropy', () {
    final seen = <String>{};
    for (var i = 0; i < 20; i++) {
      final phrase = WalletCrypto.generateMnemonic();
      expect(WalletCrypto.validateMnemonic(phrase), isTrue);
      seen.add(phrase);
    }
    expect(seen.length, 20);
  });
}
