import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Offline / deferred action queue for safe, non-mutating work.
///
/// Never queues broadcast/sign/send — those always require an online, authenticated user.
/// Used for: diagnostics snapshot flush, help cache warm, soft preference sync markers.
class OfflineActionQueue {
  OfflineActionQueue({SharedPreferences? prefs}) : _prefs = prefs;

  SharedPreferences? _prefs;
  static const _kQueue = 'auvora_offline_queue_v1';

  Future<SharedPreferences> _ensure() async => _prefs ??= await SharedPreferences.getInstance();

  Future<List<OfflineQueuedAction>> peek() async {
    final prefs = await _ensure();
    final raw = prefs.getString(_kQueue);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = jsonDecode(raw);
      if (list is! List) return const [];
      return [
        for (final item in list)
          if (item is Map) OfflineQueuedAction.fromJson(Map<String, dynamic>.from(item)),
      ];
    } catch (_) {
      // Corrupt queue — drop it (recovery).
      await prefs.remove(_kQueue);
      return const [];
    }
  }

  Future<void> enqueue(OfflineQueuedAction action) async {
    if (!action.isSafeOffline) {
      throw StateError('Unsafe action refused by offline queue: ${action.kind}');
    }
    final current = [...await peek(), action];
    // Cap queue to avoid unbounded growth.
    final trimmed = current.length > 40 ? current.sublist(current.length - 40) : current;
    final prefs = await _ensure();
    await prefs.setString(
      _kQueue,
      jsonEncode([for (final a in trimmed) a.toJson()]),
    );
  }

  /// Drain queue when online. Returns count processed.
  Future<int> drain(Future<void> Function(OfflineQueuedAction action) handler) async {
    final items = await peek();
    if (items.isEmpty) return 0;
    var processed = 0;
    final remaining = <OfflineQueuedAction>[];
    for (final item in items) {
      try {
        await handler(item);
        processed += 1;
      } catch (_) {
        final next = item.copyWith(attempts: item.attempts + 1);
        if (next.attempts < 5) remaining.add(next);
      }
    }
    final prefs = await _ensure();
    if (remaining.isEmpty) {
      await prefs.remove(_kQueue);
    } else {
      await prefs.setString(
        _kQueue,
        jsonEncode([for (final a in remaining) a.toJson()]),
      );
    }
    return processed;
  }

  Future<void> clear() async {
    final prefs = await _ensure();
    await prefs.remove(_kQueue);
  }
}

enum OfflineActionKind {
  warmHelpCache,
  flushDiagnosticsSnapshot,
  markSettingsTouched,
}

class OfflineQueuedAction {
  const OfflineQueuedAction({
    required this.id,
    required this.kind,
    required this.createdAt,
    this.attempts = 0,
    this.payload = const {},
  });

  final String id;
  final OfflineActionKind kind;
  final DateTime createdAt;
  final int attempts;
  final Map<String, Object?> payload;

  /// Mutating wallet ops are never safe offline in this queue.
  bool get isSafeOffline => switch (kind) {
        OfflineActionKind.warmHelpCache => true,
        OfflineActionKind.flushDiagnosticsSnapshot => true,
        OfflineActionKind.markSettingsTouched => true,
      };

  OfflineQueuedAction copyWith({int? attempts}) {
    return OfflineQueuedAction(
      id: id,
      kind: kind,
      createdAt: createdAt,
      attempts: attempts ?? this.attempts,
      payload: payload,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'kind': kind.name,
        'createdAt': createdAt.toIso8601String(),
        'attempts': attempts,
        'payload': payload,
      };

  factory OfflineQueuedAction.fromJson(Map<String, dynamic> json) {
    return OfflineQueuedAction(
      id: json['id'] as String,
      kind: OfflineActionKind.values.firstWhere(
        (k) => k.name == json['kind'],
        orElse: () => OfflineActionKind.markSettingsTouched,
      ),
      createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '') ?? DateTime.now(),
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      payload: Map<String, Object?>.from(json['payload'] as Map? ?? const {}),
    );
  }
}
