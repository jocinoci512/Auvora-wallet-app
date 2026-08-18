import 'dart:async';
import 'dart:math';

import 'wallet_crypto.dart';

/// Onboarding / Security Center quiz that proves the user retained the phrase.
///
/// Wrong selections never mark a position complete and never advance.
/// Choices are frozen at construction so taps cannot reshuffle the quiz.
class PhraseConfirmationSession {
  PhraseConfirmationSession({
    required List<String> words,
    required List<int> positions,
    required Map<int, List<String>> choices,
  })  : words = List<String>.unmodifiable(words),
        positions = List<int>.unmodifiable(positions),
        choices = Map<int, List<String>>.unmodifiable({
          for (final e in choices.entries) e.key: List<String>.unmodifiable(e.value),
        }) {
    if (this.words.isEmpty || this.positions.isEmpty) {
      throw ArgumentError('Phrase confirmation requires a mnemonic and quiz positions.');
    }
    for (final i in this.positions) {
      if (i < 0 || i >= this.words.length) {
        throw ArgumentError('Quiz position $i is outside the phrase.');
      }
      final opts = this.choices[i] ?? const <String>[];
      if (!opts.contains(this.words[i])) {
        throw StateError('Quiz choices for word #${i + 1} omit the correct word.');
      }
      if (opts.toSet().length != opts.length) {
        throw StateError('Quiz choices for word #${i + 1} contain duplicates.');
      }
    }
  }

  factory PhraseConfirmationSession.fromMnemonic(
    String mnemonic, {
    int quizSize = 3,
    int distractors = 2,
    Random? random,
  }) {
    if (!WalletCrypto.validateMnemonic(mnemonic)) {
      throw ArgumentError('Phrase confirmation requires a valid BIP-39 mnemonic.');
    }
    final words = WalletCrypto.words(mnemonic);
    final positions = WalletCrypto.pickQuizIndices(words.length, quizSize: quizSize, random: random);
    final choices = {
      for (final i in positions)
        i: WalletCrypto.quizChoices(words, i, distractors: distractors, random: random),
    };
    return PhraseConfirmationSession(words: words, positions: positions, choices: choices);
  }

  final List<String> words;
  final List<int> positions;
  final Map<int, List<String>> choices;
  final Map<int, String> answers = {};

  int cursor = 0;
  String? error;

  static const wrongWordMessage = 'That isn’t the word for this position. Try again.';

  int get currentIndex => positions[cursor.clamp(0, positions.length - 1)];

  List<String> get currentChoices => choices[currentIndex] ?? const <String>[];

  bool get complete => positions.every((i) => answers[i] == words[i]);

  bool get onLastQuestion => cursor >= positions.length - 1;

  /// Accepts [word] only when it is exactly the mnemonic word at the current
  /// 0-based index. Wrong answers stay on this step and do not reveal the answer.
  bool select(String word) {
    error = null;
    final index = currentIndex;
    if (word != words[index]) {
      answers.remove(index);
      error = wrongWordMessage;
      return false;
    }
    answers[index] = word;
    return true;
  }

  /// Advance only if the stored answer for this position is still correct.
  bool advanceIfCurrentCorrect() {
    final index = currentIndex;
    if (answers[index] != words[index]) return false;
    if (cursor < positions.length - 1) {
      cursor += 1;
      error = null;
      return true;
    }
    return false;
  }
}

/// One-shot delayed advance that always re-checks the session before moving.
class PhraseAdvanceScheduler {
  PhraseAdvanceScheduler({required this.session, required this.onTick});

  final PhraseConfirmationSession session;
  final void Function() onTick;
  Timer? _timer;

  void cancel() {
    _timer?.cancel();
    _timer = null;
  }

  void schedule({required bool reduceMotion, Duration delay = const Duration(milliseconds: 180)}) {
    cancel();
    void go() {
      _timer = null;
      if (session.advanceIfCurrentCorrect()) {
        onTick();
      }
    }

    if (reduceMotion) {
      go();
      return;
    }
    _timer = Timer(delay, go);
  }
}
