import 'dart:async';

import 'package:flutter/widgets.dart';

import '../portfolio/portfolio_controller.dart';
import '../preferences/preferences_controller.dart';
import 'network_manager.dart';
import 'sync_engine.dart';

/// Debounced, lifecycle-aware portfolio sync. Coalesces in-flight refreshes and
/// triggers a soft refresh when the device returns online.
class SyncCoordinator extends ChangeNotifier with WidgetsBindingObserver {
  SyncCoordinator({
    required SyncEngine syncEngine,
    required NetworkManager networkManager,
    required PortfolioController portfolio,
    PreferencesController? preferences,
  })  : _syncEngine = syncEngine,
        _networkManager = networkManager,
        _portfolio = portfolio,
        _preferences = preferences;

  final SyncEngine _syncEngine;
  final NetworkManager _networkManager;
  final PortfolioController _portfolio;
  PreferencesController? _preferences;

  Timer? _debounce;
  Timer? _healthTimer;
  Future<void>? _inFlight;
  bool _started = false;
  bool _wasOffline = false;
  DateTime? lastTriggeredAt;
  int reconnectRefreshCount = 0;
  int coalescedCount = 0;

  SyncEngine get syncEngine => _syncEngine;

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
    final future = _portfolio.refresh(address, soft: true);
    _inFlight = future;
    try {
      await future;
      _syncEngine.noteCoordinatorEvent(reason);
    } finally {
      _inFlight = null;
      notifyListeners();
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
      requestRefresh(reason: 'resume', debounce: const Duration(milliseconds: 200));
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _debounce?.cancel();
    }
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
