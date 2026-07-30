import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../release/release_config.dart';

enum BetaFeedbackCategory {
  bug,
  suggestion,
  confusingUx,
  performance,
  security,
  accessibility,
}

extension BetaFeedbackCategoryLabel on BetaFeedbackCategory {
  String get label => switch (this) {
        BetaFeedbackCategory.bug => 'Bug',
        BetaFeedbackCategory.suggestion => 'Suggestion',
        BetaFeedbackCategory.confusingUx => 'Confusing UX',
        BetaFeedbackCategory.performance => 'Performance',
        BetaFeedbackCategory.security => 'Security concern',
        BetaFeedbackCategory.accessibility => 'Accessibility',
      };

  String get id => name;
}

class BetaFeedbackReport {
  BetaFeedbackReport({
    required this.id,
    required this.category,
    required this.summary,
    required this.details,
    required this.createdAt,
    required this.includeDiagnostics,
    this.diagnostics,
    this.journey,
  });

  final String id;
  final BetaFeedbackCategory category;
  final String summary;
  final String details;
  final DateTime createdAt;
  final bool includeDiagnostics;
  final Map<String, Object?>? diagnostics;
  final String? journey;

  Map<String, Object?> toJson() => {
        'id': id,
        'category': category.id,
        'summary': summary,
        'details': details,
        'createdAt': createdAt.toIso8601String(),
        'includeDiagnostics': includeDiagnostics,
        if (includeDiagnostics && diagnostics != null) 'diagnostics': diagnostics,
        if (journey != null) 'journey': journey,
        'appVersion': ReleaseConfig.marketingVersion,
        'channel': ReleaseConfig.releaseChannel,
      };

  String toSharePayload() => const JsonEncoder.withIndent('  ').convert(toJson());
}

/// Local-only Closed Beta feedback store. Never uploads without explicit share.
class BetaFeedbackStore {
  static const _kReports = 'auvora_beta_feedback_v1';

  Future<List<BetaFeedbackReport>> list() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kReports);
    if (raw == null || raw.isEmpty) return const [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list.map((item) {
      final m = item as Map<String, dynamic>;
      return BetaFeedbackReport(
        id: m['id'] as String,
        category: BetaFeedbackCategory.values.firstWhere(
          (c) => c.name == m['category'],
          orElse: () => BetaFeedbackCategory.bug,
        ),
        summary: m['summary'] as String? ?? '',
        details: m['details'] as String? ?? '',
        createdAt: DateTime.tryParse(m['createdAt'] as String? ?? '') ?? DateTime.now(),
        includeDiagnostics: m['includeDiagnostics'] == true,
        diagnostics: (m['diagnostics'] as Map?)?.cast<String, Object?>(),
        journey: m['journey'] as String?,
      );
    }).toList();
  }

  Future<BetaFeedbackReport> submit({
    required BetaFeedbackCategory category,
    required String summary,
    required String details,
    required bool includeDiagnostics,
    String? journey,
    Map<String, Object?>? diagnostics,
  }) async {
    final report = BetaFeedbackReport(
      id: const Uuid().v4(),
      category: category,
      summary: summary.trim(),
      details: details.trim(),
      createdAt: DateTime.now(),
      includeDiagnostics: includeDiagnostics,
      diagnostics: includeDiagnostics ? diagnostics : null,
      journey: journey,
    );
    final existing = await list();
    final next = [report, ...existing].take(50).toList();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _kReports,
      jsonEncode(next.map((r) => r.toJson()).toList()),
    );
    return report;
  }

  /// Safe diagnostics — never keys, phrases, or PINs.
  static Map<String, Object?> buildSafeDiagnostics({
    required bool offline,
    required bool hasPin,
    required bool biometricsEnabled,
    required String syncState,
    int? coldStartMs,
  }) {
    return {
      'platform': defaultTargetPlatform.name,
      'channel': ReleaseConfig.releaseChannel,
      'version': ReleaseConfig.marketingVersion,
      'derivationMode': ReleaseConfig.derivationMode.name,
      'liveBroadcastEnabled': ReleaseConfig.liveBroadcastEnabled,
      'allowFundingAddresses': ReleaseConfig.allowFundingAddresses,
      'offline': offline,
      'hasPin': hasPin,
      'biometricsEnabled': biometricsEnabled,
      'syncState': syncState,
      if (coldStartMs != null) 'coldStartMs': coldStartMs,
      'exportedAt': DateTime.now().toIso8601String(),
      'privacyNote': 'No recovery phrase, private keys, PIN, or addresses included.',
    };
  }
}
