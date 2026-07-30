import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../portfolio/models.dart';
import 'catalog.dart';
import 'models.dart';
import 'portfolio_summaries.dart';

/// On-device Auvora Intelligence — instant catalog, local prefs, no external AI by default.
class IntelligenceController extends ChangeNotifier {
  SharedPreferences? _prefs;
  IntelligencePrefs prefs = const IntelligencePrefs();
  bool loading = true;

  /// Tip trigger waiting to surface once (import / biometrics / first tx).
  String? _pendingTrigger;

  static const _kBlob = 'auvora_intelligence_v1';

  Future<void> bootstrap() async {
    if (!loading && _prefs != null) return;
    _prefs ??= await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_kBlob);
    if (raw != null && raw.isNotEmpty) {
      try {
        prefs = IntelligencePrefs.fromJson(
          Map<String, dynamic>.from(jsonDecode(raw) as Map),
        );
      } catch (_) {
        prefs = const IntelligencePrefs();
      }
    }
    loading = false;
    notifyListeners();
  }

  Future<void> _persist() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kBlob, jsonEncode(prefs.toJson()));
  }

  Future<void> setGuidanceLevel(GuidanceLevel level) async {
    prefs = prefs.copyWith(guidanceLevel: level);
    await _persist();
    notifyListeners();
  }

  Future<void> setEducationalHints(bool value) async {
    prefs = prefs.copyWith(educationalHints: value);
    await _persist();
    notifyListeners();
  }

  Future<void> setAllowExternalAi(bool value) async {
    prefs = prefs.copyWith(allowExternalAi: value);
    await _persist();
    notifyListeners();
  }

  Future<void> dismissTip(String id) async {
    final next = {...prefs.dismissedTipIds, id};
    prefs = prefs.copyWith(dismissedTipIds: next);
    if (_pendingTrigger != null) {
      final tip = tipFor(_pendingTrigger!);
      if (tip == null || tip.id == id) _pendingTrigger = null;
    }
    await _persist();
    notifyListeners();
  }

  Future<void> resetDismissedTips() async {
    prefs = prefs.copyWith(dismissedTipIds: {});
    await _persist();
    notifyListeners();
  }

  /// Queue a one-shot contextual tip for the next calm surface (Home / done).
  void noteEvent(String trigger) {
    if (!showEducationalHints) return;
    final tip = tipFor(trigger);
    if (tip == null) return;
    _pendingTrigger = trigger;
    notifyListeners();
  }

  bool get showEducationalHints =>
      prefs.educationalHints && prefs.guidanceLevel != GuidanceLevel.minimal;

  bool shouldShowTip(String tipId) {
    if (!showEducationalHints) return false;
    if (prefs.dismissedTipIds.contains(tipId)) return false;
    return true;
  }

  /// Security / failure explanations still surface on minimal — tips do not.
  bool shouldShowExplanation(IntelligenceKind kind) {
    if (prefs.guidanceLevel == GuidanceLevel.minimal) {
      return kind == IntelligenceKind.security ||
          kind == IntelligenceKind.transaction ||
          kind == IntelligenceKind.network;
    }
    return true;
  }

  ContextualTip? tipFor(String trigger) {
    if (!showEducationalHints) return null;
    // homeIdle is intentionally never queued — meta tips distract from the wallet.
    if (trigger == 'homeIdle') return null;
    for (final tip in IntelligenceCatalog.contextualTips) {
      if (tip.trigger != trigger) continue;
      if (!shouldShowTip(tip.id)) continue;
      return tip;
    }
    return null;
  }

  /// Tip waiting after a meaningful event — not ambient chatter.
  ContextualTip? get pendingTip {
    final trigger = _pendingTrigger;
    if (trigger == null) return null;
    return tipFor(trigger);
  }

  List<PortfolioSummaryLine> portfolioSummaries(PortfolioSnapshot? snap) {
    if (!shouldShowExplanation(IntelligenceKind.portfolio)) return const [];
    if (prefs.guidanceLevel == GuidanceLevel.minimal) return const [];
    final max = prefs.guidanceLevel == GuidanceLevel.full ? 2 : 1;
    return PortfolioIntelligence.summarize(snap, maxLines: max);
  }

  IntelligenceExplanation? transactionExplanation(PortfolioTx tx) {
    if (!shouldShowExplanation(IntelligenceKind.transaction)) return null;
    return IntelligenceCatalog.explainTransaction(tx);
  }

  /// Full panels for failures / elevated risk; compact otherwise.
  bool useCompactExplanation(IntelligenceExplanation explanation) {
    if (prefs.guidanceLevel == GuidanceLevel.full) return false;
    return explanation.id == 'tx-done' ||
        explanation.id == 'tx-swap-done' ||
        explanation.id == 'tx-bridge-done' ||
        explanation.id == 'fee-normal' ||
        explanation.id == 'sec-connect' ||
        explanation.id == 'net-ok';
  }

  List<SearchAssistHit> searchAssist(String query) => IntelligenceCatalog.searchAssist(query);

  List<LearnLesson> lessons({String query = ''}) => IntelligenceCatalog.searchLessons(query);
}
