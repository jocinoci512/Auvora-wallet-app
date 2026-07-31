import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../connections/connections_controller.dart';
import '../state/wallet_controller.dart';
import '../wallet_engine/wallet_engine.dart';
import 'security_models.dart';

class SecurityController extends ChangeNotifier {
  WalletController? _walletController;
  ConnectionsController? _connections;
  SharedPreferences? _prefs;

  SecurityPreferences preferences = const SecurityPreferences();
  List<TrustedDevice> devices = const [];
  List<ActiveSession> sessions = const [];
  List<ConnectedDapp> dapps = const [];
  List<SecurityAlertItem> alerts = const [];
  bool loading = true;

  static const _kPrefs = 'auvora_security_center_prefs_v1';
  static const _kDevices = 'auvora_security_devices_v1';
  static const _kSessions = 'auvora_security_sessions_v1';
  static const _kAlerts = 'auvora_security_alerts_v1';

  void attach({
    required WalletController walletController,
    required WalletEngine walletEngine,
  }) {
    _walletController = walletController;
  }

  void attachConnections(ConnectionsController connections) {
    if (identical(_connections, connections)) {
      _syncDappsFromConnections();
      return;
    }
    _connections?.removeListener(_onConnectionsChanged);
    _connections = connections;
    _connections!.addListener(_onConnectionsChanged);
    _syncDappsFromConnections();
  }

  @override
  void dispose() {
    _connections?.removeListener(_onConnectionsChanged);
    super.dispose();
  }

  void _onConnectionsChanged() {
    _syncDappsFromConnections();
    notifyListeners();
  }

  void _syncDappsFromConnections() {
    final connections = _connections;
    if (connections == null || connections.loading) return;
    dapps = connections.connectedDappsSummary;
  }

  Future<void> bootstrap() async {
    if (!loading) return;
    _prefs ??= await SharedPreferences.getInstance();
    preferences = _readPrefs();
    devices = _readDevices();
    sessions = _readSessions();
    alerts = _readAlerts();
    await _connections?.bootstrap();
    _syncDappsFromConnections();
    // Never invent connected apps — empty means none in this Alpha build.
    loading = false;
    notifyListeners();
  }

  SecuritySnapshot buildSnapshot() {
    final wallet = _walletController;
    final backupComplete = wallet?.wallet?.backupConfirmed == true;
    final phraseVerified = wallet?.wallet?.phraseVerifiedAt != null;
    final pinEnabled = wallet?.hasPin == true;
    final biometricsEnabled = wallet?.biometricsEnabled == true;
    final reviewAt = preferences.lastReviewAt ?? wallet?.wallet?.lastSecurityReviewAt;
    final score = _score(
      backupComplete: backupComplete,
      phraseVerified: phraseVerified,
      pinEnabled: pinEnabled,
      biometricsEnabled: biometricsEnabled,
      trustedDeviceReview: preferences.reviewedTrustedDevices,
      dappReview: preferences.reviewedConnectedDapps,
      sessionsReview: preferences.reviewedSessions,
      notificationPrivacy: preferences.notificationPrivacy,
      appUpdated: preferences.appUpdated,
      recentReview: reviewAt != null && DateTime.now().difference(reviewAt).inDays <= 30,
      hasUntrustedDevices: devices.any((item) => !item.trusted),
      hasRiskyDapps: dapps.any((item) => item.warning != null || item.permissions.length >= 3),
      unknownSessions: sessions.any((item) => !item.current && item.location.contains('Unknown')),
    );
    final steps = [
      SecurityCheckStep(
        id: 'backup',
        title: 'Recovery phrase backed up',
        description: 'A written backup is the safest recovery path if you lose this device.',
        done: backupComplete,
        actionLabel: backupComplete ? 'Review backup' : 'Back up phrase',
      ),
      SecurityCheckStep(
        id: 'verify',
        title: 'Recovery phrase verified',
        description: 'Verification proves you can actually restore the wallet later.',
        done: phraseVerified,
        actionLabel: phraseVerified ? 'Verified' : 'Verify phrase',
      ),
      SecurityCheckStep(
        id: 'biometric',
        title: 'Biometrics enabled',
        description: 'Biometrics speed secure access while keeping passcode fallback.',
        done: biometricsEnabled,
        actionLabel: biometricsEnabled ? 'Manage biometrics' : 'Enable biometrics',
      ),
      SecurityCheckStep(
        id: 'pin',
        title: 'Strong PIN enabled',
        description: 'A 6-digit PIN protects the wallet if biometrics are unavailable.',
        done: pinEnabled,
        actionLabel: pinEnabled ? 'Change PIN' : 'Set PIN',
      ),
      SecurityCheckStep(
        id: 'devices',
        title: 'Trusted devices reviewed',
        description: 'Review device access regularly so unfamiliar devices stand out quickly.',
        done: preferences.reviewedTrustedDevices,
        actionLabel: 'Review devices',
      ),
      SecurityCheckStep(
        id: 'dapps',
        title: 'Connected apps reviewed',
        description: 'Unused permissions can stay active until you disconnect them.',
        done: preferences.reviewedConnectedDapps,
        actionLabel: 'Review dApps',
      ),
      SecurityCheckStep(
        id: 'sessions',
        title: 'Active sessions reviewed',
        description: 'Sign out anything you don’t recognize. Only this device is trusted by default.',
        done: preferences.reviewedSessions,
        actionLabel: 'Review sessions',
      ),
      SecurityCheckStep(
        id: 'clipboard',
        title: 'Clipboard auto-clear on',
        description: 'Copied addresses clear after a short timeout so they don’t linger.',
        done: preferences.clipboardTimeoutSeconds > 0,
        actionLabel: 'Review clipboard',
      ),
      SecurityCheckStep(
        id: 'notifications',
        title: 'Notification privacy on',
        description: 'Balance amounts stay hidden in notification previews.',
        done: preferences.notificationPrivacy,
        actionLabel: preferences.notificationPrivacy ? 'Enabled' : 'Enable',
      ),
      SecurityCheckStep(
        id: 'app',
        title: 'App is up to date',
        description: 'Security fixes ship through updates. Staying current reduces avoidable risk.',
        done: preferences.appUpdated,
        actionLabel: 'Confirm update',
      ),
    ];
    return SecuritySnapshot(
      score: score,
      status: securityStatusForScore(score),
      backupComplete: backupComplete,
      recoveryPhraseVerified: phraseVerified,
      biometricsEnabled: biometricsEnabled,
      pinEnabled: pinEnabled,
      activeSessions: sessions,
      connectedDapps: dapps,
      trustedDevices: devices,
      recentAlerts: alerts.take(5).toList(),
      preferences: preferences,
      checkSteps: steps,
      recommendations: _recommendations(
        backupComplete: backupComplete,
        phraseVerified: phraseVerified,
        pinEnabled: pinEnabled,
        biometricsEnabled: biometricsEnabled,
      ),
    );
  }

  Future<void> patchPreferences(SecurityPreferences next) async {
    preferences = next;
    await _persistPrefs();
    notifyListeners();
  }

  Future<void> reviewNow() async {
    await patchPreferences(preferences.copyWith(lastReviewAt: DateTime.now()));
    await _walletController?.markSecurityReviewNow();
  }

  Future<void> markDevicesReviewed() async {
    await patchPreferences(preferences.copyWith(reviewedTrustedDevices: true, lastReviewAt: DateTime.now()));
  }

  Future<void> markDappsReviewed() async {
    await patchPreferences(preferences.copyWith(reviewedConnectedDapps: true, lastReviewAt: DateTime.now()));
  }

  Future<void> markSessionsReviewed() async {
    await patchPreferences(preferences.copyWith(reviewedSessions: true, lastReviewAt: DateTime.now()));
  }

  Future<void> confirmAppUpdated() async {
    await patchPreferences(preferences.copyWith(appUpdated: true, lastReviewAt: DateTime.now()));
  }

  Future<void> renameDevice(String id, String nextName) async {
    devices = [for (final item in devices) item.id == id ? item.copyWith(name: nextName) : item];
    await _persistDevices();
    notifyListeners();
  }

  Future<void> removeDevice(String id) async {
    devices = devices.where((item) => item.id != id).toList();
    await addAlert(
      title: 'Trusted device removed',
      description: 'A device was removed from the trusted list.',
      recommendedAction: 'Confirm the remaining device list still looks right.',
      severity: SecurityStatus.good,
    );
    await _persistDevices();
    notifyListeners();
  }

  Future<void> revokeSession(String id) async {
    sessions = sessions.where((item) => item.id != id).toList();
    await addAlert(
      title: 'Session signed out',
      description: 'A remote session was revoked from Security Center.',
      recommendedAction: 'If this was unexpected, change your PIN and review devices.',
      severity: SecurityStatus.good,
    );
    await _persistSessions();
    notifyListeners();
  }

  Future<void> signOutAllOtherSessions() async {
    final removed = sessions.where((s) => !s.current).length;
    sessions = sessions.where((s) => s.current).toList();
    await addAlert(
      title: 'Other sessions signed out',
      description: removed == 0
          ? 'No other sessions were active on this device.'
          : '$removed session${removed == 1 ? '' : 's'} signed out. This device stays signed in.',
      recommendedAction: 'Change your PIN if you didn’t initiate this.',
      severity: SecurityStatus.good,
    );
    await _persistSessions();
    notifyListeners();
  }

  /// Sends always require authentication in Closed Beta — toggle cannot weaken that.
  bool requiresAuth(AuthRequirementScope scope) {
    switch (scope) {
      case AuthRequirementScope.unlockApp:
        return preferences.requireBiometricForUnlock || (_walletController?.hasPin == true);
      case AuthRequirementScope.sendFunds:
        return true; // Fail-closed: transfers always require PIN/biometrics.
      case AuthRequirementScope.changeSettings:
        return preferences.requireAuthForSettings;
      case AuthRequirementScope.viewRecoveryPhrase:
        return preferences.requireAuthForRecoveryPhrase;
    }
  }

  Future<void> disconnectDapp(String id) async {
    final connections = _connections;
    if (connections != null) {
      await connections.disconnectSession(id);
      _syncDappsFromConnections();
    } else {
      dapps = dapps.where((item) => item.id != id).toList();
    }
    await addAlert(
      title: 'Connected app removed',
      description: 'A connected app was disconnected from this wallet preview state.',
      recommendedAction: 'Reconnect only if you still trust this app.',
      severity: SecurityStatus.good,
    );
    notifyListeners();
  }

  Future<void> addAlert({
    required String title,
    required String description,
    required String recommendedAction,
    required SecurityStatus severity,
  }) async {
    alerts = [
      SecurityAlertItem(
        id: 'alert-${DateTime.now().microsecondsSinceEpoch}',
        title: title,
        description: description,
        recommendedAction: recommendedAction,
        severity: severity,
        timestamp: DateTime.now(),
      ),
      ...alerts,
    ];
    await _persistAlerts();
    notifyListeners();
  }

  Future<void> emergencyLock() async {
    await patchPreferences(
      preferences.copyWith(
        hideSensitiveInfo: true,
        notificationPrivacy: true,
        emergencyNotificationsMuted: true,
        lastReviewAt: DateTime.now(),
      ),
    );
    await addAlert(
      title: 'Emergency lock enabled',
      description:
          'The wallet locked, sensitive previews were muted, and temporary clipboard data should be treated as cleared.',
      recommendedAction:
          'Unlock with your PIN or biometrics, then review sessions and connected apps before continuing.',
      severity: SecurityStatus.fair,
    );
    await _walletController?.lock();
  }

  Future<void> requestDataExport() async {
    await patchPreferences(preferences.copyWith(dataExportRequestedAt: DateTime.now()));
    await addAlert(
      title: 'Data export requested',
      description: 'A privacy export request was recorded on this device (preview).',
      recommendedAction: 'Exports stay local in Closed Beta. You’ll get a fuller download path at Public Beta.',
      severity: SecurityStatus.good,
    );
  }

  Future<void> requestDataDeletion() async {
    await patchPreferences(preferences.copyWith(dataDeletionRequestedAt: DateTime.now()));
    await addAlert(
      title: 'Data deletion requested',
      description: 'A deletion request was recorded. Local wipe still requires Security Center confirmation.',
      recommendedAction: 'To wipe this device now, use Account settings after unlocking. Keep your recovery phrase.',
      severity: SecurityStatus.fair,
    );
  }

  Future<void> recordAuthFailureBurst() async {
    await addAlert(
      title: 'Repeated authentication failures',
      description: 'Several incorrect passcode attempts were detected.',
      recommendedAction: 'Wait out the lockout, then unlock carefully. If this wasn’t you, remove other sessions.',
      severity: SecurityStatus.needsAttention,
    );
  }

  Future<void> markPhraseVerified() async {
    await _walletController?.markBackupConfirmed(verified: true);
    await addAlert(
      title: 'Recovery phrase verified',
      description: 'Recovery verification was completed successfully.',
      recommendedAction: 'Store the phrase separately from this device.',
      severity: SecurityStatus.good,
    );
  }

  Future<void> markBackupComplete() async {
    await _walletController?.markBackupConfirmed();
    await addAlert(
      title: 'Backup confirmed',
      description: 'A recovery backup was marked as complete.',
      recommendedAction: 'Verify the phrase next so recovery is proven, not assumed.',
      severity: SecurityStatus.good,
    );
  }

  int _score({
    required bool backupComplete,
    required bool phraseVerified,
    required bool pinEnabled,
    required bool biometricsEnabled,
    required bool trustedDeviceReview,
    required bool dappReview,
    required bool sessionsReview,
    required bool notificationPrivacy,
    required bool appUpdated,
    required bool recentReview,
    required bool hasUntrustedDevices,
    required bool hasRiskyDapps,
    required bool unknownSessions,
  }) {
    var score = 20;
    if (pinEnabled) score += 15;
    if (biometricsEnabled) score += 10;
    if (backupComplete) score += 15;
    if (phraseVerified) score += 15;
    if (recentReview) score += 8;
    if (trustedDeviceReview) score += 5;
    if (dappReview) score += 5;
    if (sessionsReview) score += 4;
    if (notificationPrivacy) score += 3;
    if (appUpdated) score += 5;
    if (hasUntrustedDevices) score -= 10;
    if (hasRiskyDapps) score -= 5;
    if (unknownSessions) score -= 10;
    return score.clamp(0, 100);
  }

  List<String> _recommendations({
    required bool backupComplete,
    required bool phraseVerified,
    required bool pinEnabled,
    required bool biometricsEnabled,
  }) {
    final tips = <String>[];
    if (!backupComplete) {
      tips.add('Your recovery phrase is the only way to recover your wallet — confirm a written backup.');
    }
    if (!phraseVerified) {
      tips.add('Verify your recovery phrase so recovery is proven, not assumed.');
    }
    if (!pinEnabled) {
      tips.add('Set a 6-digit PIN so this wallet stays locked if biometrics fail.');
    }
    if (!biometricsEnabled) {
      tips.add('Biometric authentication protects access on this device while keeping PIN fallback.');
    }
    if (!preferences.reviewedConnectedDapps) {
      tips.add('Review connected applications regularly and disconnect anything you don’t recognize.');
    }
    if (!preferences.reviewedSessions) {
      tips.add('Check active sessions and sign out anything unfamiliar.');
    }
    tips.add('Only approve transactions you fully understand.');
    return tips.take(4).toList();
  }

  SecurityPreferences _readPrefs() {
    final raw = _prefs?.getString(_kPrefs);
    if (raw == null || raw.isEmpty) return const SecurityPreferences();
    final data = jsonDecode(raw) as Map<String, dynamic>;
    return SecurityPreferences(
      requireBiometricForUnlock: data['requireBiometricForUnlock'] == true,
      requireAuthForSend: data['requireAuthForSend'] != false,
      requireAuthForSettings: data['requireAuthForSettings'] != false,
      requireAuthForRecoveryPhrase: data['requireAuthForRecoveryPhrase'] != false,
      hideSensitiveInfo: data['hideSensitiveInfo'] == true,
      analyticsEnabled: data['analyticsEnabled'] == true,
      crashReportingEnabled: data['crashReportingEnabled'] == true,
      notificationPrivacy: data['notificationPrivacy'] != false,
      clipboardTimeoutSeconds: (data['clipboardTimeoutSeconds'] as num?)?.toInt() ?? 30,
      screenshotProtection: data['screenshotProtection'] == true,
      lastReviewAt: DateTime.tryParse((data['lastReviewAt'] as String?) ?? ''),
      appUpdated: data['appUpdated'] == true,
      reviewedTrustedDevices: data['reviewedTrustedDevices'] == true,
      reviewedConnectedDapps: data['reviewedConnectedDapps'] == true,
      reviewedSessions: data['reviewedSessions'] == true,
      emergencyNotificationsMuted: data['emergencyNotificationsMuted'] == true,
      dataExportRequestedAt: DateTime.tryParse((data['dataExportRequestedAt'] as String?) ?? ''),
      dataDeletionRequestedAt: DateTime.tryParse((data['dataDeletionRequestedAt'] as String?) ?? ''),
    );
  }

  List<TrustedDevice> _readDevices() {
    final raw = _prefs?.getString(_kDevices);
    if (raw == null || raw.isEmpty) {
      // This device only — never seed fake "unknown" devices that inflate risk.
      return [
        TrustedDevice(
          id: 'dev-current',
          name: 'This phone',
          platform: 'Current device',
          appVersion: '1.0.0-alpha',
          lastActiveAt: DateTime.now(),
          current: true,
          trusted: true,
        ),
      ];
    }
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((item) => TrustedDevice(
              id: item['id'] as String,
              name: item['name'] as String,
              platform: item['platform'] as String,
              appVersion: item['appVersion'] as String,
              lastActiveAt: DateTime.parse(item['lastActiveAt'] as String),
              current: item['current'] == true,
              trusted: item['trusted'] == true,
            ))
        .toList();
  }

  List<ActiveSession> _readSessions() {
    final raw = _prefs?.getString(_kSessions);
    if (raw == null || raw.isEmpty) {
      return [
        ActiveSession(
          id: 'sess-current',
          deviceName: 'This phone',
          platform: 'Auvora mobile',
          location: 'This device',
          loginAt: DateTime.now().subtract(const Duration(hours: 1)),
          lastActiveAt: DateTime.now(),
          authMethod: 'Passcode',
          current: true,
        ),
      ];
    }
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((item) => ActiveSession(
              id: item['id'] as String,
              deviceName: item['deviceName'] as String,
              platform: item['platform'] as String,
              location: item['location'] as String,
              loginAt: DateTime.parse(item['loginAt'] as String),
              lastActiveAt: DateTime.parse(item['lastActiveAt'] as String),
              authMethod: item['authMethod'] as String,
              current: item['current'] == true,
            ))
        .toList();
  }

  List<SecurityAlertItem> _readAlerts() {
    final raw = _prefs?.getString(_kAlerts);
    if (raw == null || raw.isEmpty) return const <SecurityAlertItem>[];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((item) => SecurityAlertItem(
              id: item['id'] as String,
              title: item['title'] as String,
              description: item['description'] as String,
              recommendedAction: item['recommendedAction'] as String,
              severity: SecurityStatus.values[item['severity'] as int],
              timestamp: DateTime.parse(item['timestamp'] as String),
            ))
        .toList();
  }

  Future<void> _persistPrefs() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(
      _kPrefs,
      jsonEncode({
        'requireBiometricForUnlock': preferences.requireBiometricForUnlock,
        'requireAuthForSend': preferences.requireAuthForSend,
        'requireAuthForSettings': preferences.requireAuthForSettings,
        'requireAuthForRecoveryPhrase': preferences.requireAuthForRecoveryPhrase,
        'hideSensitiveInfo': preferences.hideSensitiveInfo,
        'analyticsEnabled': preferences.analyticsEnabled,
        'crashReportingEnabled': preferences.crashReportingEnabled,
        'notificationPrivacy': preferences.notificationPrivacy,
        'clipboardTimeoutSeconds': preferences.clipboardTimeoutSeconds,
        'screenshotProtection': preferences.screenshotProtection,
        'lastReviewAt': preferences.lastReviewAt?.toIso8601String(),
        'appUpdated': preferences.appUpdated,
        'reviewedTrustedDevices': preferences.reviewedTrustedDevices,
        'reviewedConnectedDapps': preferences.reviewedConnectedDapps,
        'reviewedSessions': preferences.reviewedSessions,
        'emergencyNotificationsMuted': preferences.emergencyNotificationsMuted,
        'dataExportRequestedAt': preferences.dataExportRequestedAt?.toIso8601String(),
        'dataDeletionRequestedAt': preferences.dataDeletionRequestedAt?.toIso8601String(),
      }),
    );
  }

  Future<void> _persistDevices() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kDevices, jsonEncode([
      for (final item in devices)
        {
          'id': item.id,
          'name': item.name,
          'platform': item.platform,
          'appVersion': item.appVersion,
          'lastActiveAt': item.lastActiveAt.toIso8601String(),
          'current': item.current,
          'trusted': item.trusted,
        },
    ]));
  }

  Future<void> _persistSessions() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kSessions, jsonEncode([
      for (final item in sessions)
        {
          'id': item.id,
          'deviceName': item.deviceName,
          'platform': item.platform,
          'location': item.location,
          'loginAt': item.loginAt.toIso8601String(),
          'lastActiveAt': item.lastActiveAt.toIso8601String(),
          'authMethod': item.authMethod,
          'current': item.current,
        },
    ]));
  }

  Future<void> _persistAlerts() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kAlerts, jsonEncode([
      for (final item in alerts)
        {
          'id': item.id,
          'title': item.title,
          'description': item.description,
          'recommendedAction': item.recommendedAction,
          'severity': item.severity.index,
          'timestamp': item.timestamp.toIso8601String(),
        },
    ]));
  }

  // Demo seed data removed — Closed Beta uses this-device-only defaults via _readDevices/_readSessions.
}
