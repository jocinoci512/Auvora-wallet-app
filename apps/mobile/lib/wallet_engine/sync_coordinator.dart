import 'dart:async';

import 'package:flutter/widgets.dart';

import '../portfolio/portfolio_controller.dart';
import '../preferences/preferences_controller.dart';
import '../reliability/offline_queue.dart';
import 'network_manager.dart';
import 'sync_engine.dart';

/// Debounced, lifecycle-aware portfolio sync. Coalesces in-flight refreshes and
/// triggers a soft refresh when the device returns online.
///
/// OS-level WorkManager / BGTaskScheduler hooks are not wired on this host;
/// foreground resume + reconnect + periodic health remain the refresh triggers.
class SyncCoordinator extends ChangeNotifier with WidgetsBindingObserver {
  SyncCoordinator({
    required SyncEngine syncEngine,
    required NetworkManager networkManager,
    required PortfolioController portfolio,
    PreferencesController? preferences,
    OfflineActionQueue? offlineQueue,
  })  : _syncEngine = syncEngine,
        _networkManager = networkManager,
        _portfolio = portfolio,
        _preferences = preferences,
        _offlineQueue = offlineQueue ?? OfflineActionQueue();

  final SyncEngine _syncEngine;
  final NetworkManager _networkManager;
  final PortfolioController _portfolio;
  PreferencesController? _preferences;
  final OfflineActionQueue _offlineQueue;

  Timer? _debounce;
  Timer? _healthTimer;
  Timer? _pendingTick;
  Future<void>? _inFlight;
  bool _started = false;
  bool _wasOffline = false;
  DateTime? lastTriggeredAt;
  int reconnectRefreshCount = 0;
  int coalescedCount = 0;
  int resumeRefreshCount = 0;
  int pauseCancelCount = 0;
  int pendingTxRefreshCount = 0;
  int offlineQueueDrained = 0;
  int? lastSyncDurationMs;

  SyncEngine get syncEngine => _syncEngine;
  OfflineActionQueue get offlineQueue => _offlineQueue;

  void attachPreferences(PreferencesController preferences) {
    _preferences = preferences;
  }

  void start({String? address, bool initialRefresh = false}) {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    _wasOffline = _networkManager.offline;
    _networkManager.addListener(_onNetworkChanged);
    _healthTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      if (!_autoRefreshEnabled) return;
      // ignore: discarded_futures
      _networkManager.refresh();
    });
    // Soft pending-tx poll while foregrounded — avoids hammering when idle.
    _pendingTick = Timer.periodic(const Duration(seconds: 90), (_) {
      if (!_autoRefreshEnabled) return;
      final pending = _syncEngine.syncStatus.pendingTransactions;
      if (pending <= 0) return;
      pendingTxRefreshCount += 1;
      requestRefresh(
        debounce: const Duration(milliseconds: 600),
        reason: 'pending-tx',
      );
    });
    if (initialRefresh) {
      requestRefresh(address: address, reason: 'start');
    }
  }

  void stop() {
    if (!_started) return;
    _started = false;
    WidgetsBinding.instance.removeObserver(this);
    _networkManager.removeListener(_onNetworkChanged);
    _debounce?.cancel();
    _healthTimer?.cancel();
    _pendingTick?.cancel();
  }

  bool get _autoRefreshEnabled => _preferences?.walletDisplay.autoRefresh ?? true;

  void requestRefresh({
    String? address,
    Duration debounce = const Duration(milliseconds: 400),
    String reason = 'manual',
    bool force = false,
  }) {
    if (!_autoRefreshEnabled && !force && reason != 'manual' && reason != 'start') {
      return;
    }
    lastTriggeredAt = DateTime.now();
    _debounce?.cancel();
    _debounce = Timer(debounce, () {
      // ignore: discarded_futures
      _run(address: address, reason: reason);
    });
    notifyListeners();
  }

  Future<void> _run({String? address, required String reason}) async {
    if (_inFlight != null) {
      coalescedCount += 1;
      await _inFlight;
      return;
    }
    final started = DateTime.now();
    final future = _portfolio.refresh(address, soft: true);
    _inFlight = future;
    try {
      await future;
      lastSyncDurationMs = DateTime.now().difference(started).inMilliseconds;
      _syncEngine.noteCoordinatorEvent(reason);
      _syncEngine.recordSyncDuration(Duration(milliseconds: lastSyncDurationMs!));
      if (!_networkManager.offline) {
        offlineQueueDrained += await _offlineQueue.drain(_handleQueuedAction);
      }
    } finally {
      _inFlight = null;
      notifyListeners();
    }
  }

  Future<void> _handleQueuedAction(OfflineQueuedAction action) async {
    switch (action.kind) {
      case OfflineActionKind.warmHelpCache:
        await _syncEngine.warmHelpCache();
      case OfflineActionKind.flushDiagnosticsSnapshot:
        await _syncEngine.persistDiagnosticsSnapshot(
          coordinator: diagnosticsJson(),
        );
      case OfflineActionKind.markSettingsTouched:
        // Soft marker only — preferences already persist locally.
        break;
    }
  }

  void _onNetworkChanged() {
    final offline = _networkManager.offline;
    if (_wasOffline && !offline) {
      reconnectRefreshCount += 1;
      requestRefresh(
        address: null,
        debounce: const Duration(milliseconds: 250),
        reason: 'reconnect',
        force: true,
      );
    }
    _wasOffline = offline;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      resumeRefreshCount += 1;
      requestRefresh(reason: 'resume', debounce: const Duration(milliseconds: 200));
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      pauseCancelCount += 1;
      _debounce?.cancel();
    }
  }

  Map<String, Object?> diagnosticsJson() => {
        'reconnectRefreshCount': reconnectRefreshCount,
        'coalescedCount': coalescedCount,
        'resumeRefreshCount': resumeRefreshCount,
        'pauseCancelCount': pauseCancelCount,
        'pendingTxRefreshCount': pendingTxRefreshCount,
        'offlineQueueDrained': offlineQueueDrained,
        'lastSyncDurationMs': lastSyncDurationMs,
        'lastTriggeredAt': lastTriggeredAt?.toIso8601String(),
        'backgroundOsHooks': false,
      };

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
