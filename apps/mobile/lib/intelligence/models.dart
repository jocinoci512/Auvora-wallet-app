import 'package:flutter/foundation.dart';

/// How much contextual guidance the user wants.
enum GuidanceLevel {
  /// Only critical security / failure explanations.
  minimal,
  /// Balanced tips when they reduce confusion (default).
  balanced,
  /// More educational hints and Learning Center suggestions.
  full,
}

enum IntelligenceKind {
  transaction,
  security,
  portfolio,
  network,
  contextual,
  learning,
}

@immutable
class IntelligenceExplanation {
  const IntelligenceExplanation({
    required this.id,
    required this.kind,
    required this.title,
    required this.whatHappened,
    required this.whyItMatters,
    required this.whatYouCanDo,
    this.learnTopicId,
  });

  final String id;
  final IntelligenceKind kind;
  final String title;
  /// Plain-language “what happened”.
  final String whatHappened;
  /// Plain-language “why it matters”.
  final String whyItMatters;
  /// Autonomy-respecting next steps (never “buy/sell”).
  final String whatYouCanDo;
  final String? learnTopicId;
}

@immutable
class LearnLesson {
  const LearnLesson({
    required this.id,
    required this.category,
    required this.title,
    required this.summary,
    required this.minutes,
    required this.body,
  });

  final String id;
  final String category;
  final String title;
  final String summary;
  final int minutes;
  final List<String> body;
}

@immutable
class SearchAssistHit {
  const SearchAssistHit({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.route,
    this.keywords = const [],
  });

  final String id;
  final String title;
  final String subtitle;
  /// Logical route key consumed by the search UI navigator.
  final String route;
  final List<String> keywords;
}

@immutable
class ContextualTip {
  const ContextualTip({
    required this.id,
    required this.title,
    required this.body,
    required this.trigger,
    this.learnTopicId,
  });

  final String id;
  final String title;
  final String body;
  /// e.g. afterImport, afterBiometrics, afterFirstTx, homeIdle
  final String trigger;
  final String? learnTopicId;
}

@immutable
class PortfolioSummaryLine {
  const PortfolioSummaryLine({
    required this.id,
    required this.text,
  });

  final String id;
  final String text;
}

@immutable
class IntelligencePrefs {
  const IntelligencePrefs({
    this.guidanceLevel = GuidanceLevel.balanced,
    this.educationalHints = true,
    this.allowExternalAi = false,
    this.dismissedTipIds = const {},
  });

  final GuidanceLevel guidanceLevel;
  final bool educationalHints;
  /// Off by default — no sensitive wallet data leaves the device without consent.
  final bool allowExternalAi;
  final Set<String> dismissedTipIds;

  IntelligencePrefs copyWith({
    GuidanceLevel? guidanceLevel,
    bool? educationalHints,
    bool? allowExternalAi,
    Set<String>? dismissedTipIds,
  }) {
    return IntelligencePrefs(
      guidanceLevel: guidanceLevel ?? this.guidanceLevel,
      educationalHints: educationalHints ?? this.educationalHints,
      allowExternalAi: allowExternalAi ?? this.allowExternalAi,
      dismissedTipIds: dismissedTipIds ?? this.dismissedTipIds,
    );
  }

  Map<String, dynamic> toJson() => {
        'guidanceLevel': guidanceLevel.name,
        'educationalHints': educationalHints,
        'allowExternalAi': allowExternalAi,
        'dismissedTipIds': dismissedTipIds.toList(),
      };

  factory IntelligencePrefs.fromJson(Map<String, dynamic> json) {
    return IntelligencePrefs(
      guidanceLevel: GuidanceLevel.values.firstWhere(
        (g) => g.name == json['guidanceLevel'],
        orElse: () => GuidanceLevel.balanced,
      ),
      educationalHints: json['educationalHints'] != false,
      allowExternalAi: json['allowExternalAi'] == true,
      dismissedTipIds: ((json['dismissedTipIds'] as List?) ?? const [])
          .whereType<String>()
          .toSet(),
    );
  }
}
