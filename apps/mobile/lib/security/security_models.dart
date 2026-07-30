import 'package:flutter/foundation.dart';

enum SecurityStatus { excellent, good, fair, needsAttention }

enum AuthRequirementScope { unlockApp, sendFunds, changeSettings, viewRecoveryPhrase }

@immutable
class TrustedDevice {
  const TrustedDevice({
    required this.id,
    required this.name,
    required this.platform,
    required this.appVersion,
    required this.lastActiveAt,
    required this.current,
    required this.trusted,
  });

  final String id;
  final String name;
  final String platform;
  final String appVersion;
  final DateTime lastActiveAt;
  final bool current;
  final bool trusted;

  TrustedDevice copyWith({String? name, DateTime? lastActiveAt, bool? current, bool? trusted}) {
    return TrustedDevice(
      id: id,
      name: name ?? this.name,
      platform: platform,
      appVersion: appVersion,
      lastActiveAt: lastActiveAt ?? this.lastActiveAt,
      current: current ?? this.current,
      trusted: trusted ?? this.trusted,
    );
  }
}

@immutable
class ActiveSession {
  const ActiveSession({
    required this.id,
    required this.deviceName,
    required this.platform,
    required this.location,
    required this.loginAt,
    required this.lastActiveAt,
    required this.authMethod,
    required this.current,
  });

  final String id;
  final String deviceName;
  final String platform;
  final String location;
  final DateTime loginAt;
  final DateTime lastActiveAt;
  final String authMethod;
  final bool current;
}

@immutable
class ConnectedDapp {
  const ConnectedDapp({
    required this.id,
    required this.name,
    required this.website,
    required this.connectedAt,
    required this.permissions,
    this.warning,
  });

  final String id;
  final String name;
  final String website;
  final DateTime connectedAt;
  final List<String> permissions;
  final String? warning;
}

@immutable
class SecurityAlertItem {
  const SecurityAlertItem({
    required this.id,
    required this.title,
    required this.description,
    required this.recommendedAction,
    required this.severity,
    required this.timestamp,
  });

  final String id;
  final String title;
  final String description;
  final String recommendedAction;
  final SecurityStatus severity;
  final DateTime timestamp;
}

@immutable
class SecurityCheckStep {
  const SecurityCheckStep({
    required this.id,
    required this.title,
    required this.description,
    required this.done,
    required this.actionLabel,
  });

  final String id;
  final String title;
  final String description;
  final bool done;
  final String actionLabel;
}

@immutable
class SecurityPreferences {
  const SecurityPreferences({
    this.requireBiometricForUnlock = false,
    this.requireAuthForSend = true,
    this.requireAuthForSettings = true,
    this.requireAuthForRecoveryPhrase = true,
    this.hideSensitiveInfo = false,
    this.analyticsEnabled = false,
    this.notificationPrivacy = true,
    this.clipboardTimeoutSeconds = 30,
    this.lastReviewAt,
    this.appUpdated = true,
    this.reviewedTrustedDevices = false,
    this.reviewedConnectedDapps = false,
    this.emergencyNotificationsMuted = false,
  });

  final bool requireBiometricForUnlock;
  final bool requireAuthForSend;
  final bool requireAuthForSettings;
  final bool requireAuthForRecoveryPhrase;
  final bool hideSensitiveInfo;
  final bool analyticsEnabled;
  final bool notificationPrivacy;
  final int clipboardTimeoutSeconds;
  final DateTime? lastReviewAt;
  final bool appUpdated;
  final bool reviewedTrustedDevices;
  final bool reviewedConnectedDapps;
  final bool emergencyNotificationsMuted;

  SecurityPreferences copyWith({
    bool? requireBiometricForUnlock,
    bool? requireAuthForSend,
    bool? requireAuthForSettings,
    bool? requireAuthForRecoveryPhrase,
    bool? hideSensitiveInfo,
    bool? analyticsEnabled,
    bool? notificationPrivacy,
    int? clipboardTimeoutSeconds,
    DateTime? lastReviewAt,
    bool? appUpdated,
    bool? reviewedTrustedDevices,
    bool? reviewedConnectedDapps,
    bool? emergencyNotificationsMuted,
  }) {
    return SecurityPreferences(
      requireBiometricForUnlock: requireBiometricForUnlock ?? this.requireBiometricForUnlock,
      requireAuthForSend: requireAuthForSend ?? this.requireAuthForSend,
      requireAuthForSettings: requireAuthForSettings ?? this.requireAuthForSettings,
      requireAuthForRecoveryPhrase: requireAuthForRecoveryPhrase ?? this.requireAuthForRecoveryPhrase,
      hideSensitiveInfo: hideSensitiveInfo ?? this.hideSensitiveInfo,
      analyticsEnabled: analyticsEnabled ?? this.analyticsEnabled,
      notificationPrivacy: notificationPrivacy ?? this.notificationPrivacy,
      clipboardTimeoutSeconds: clipboardTimeoutSeconds ?? this.clipboardTimeoutSeconds,
      lastReviewAt: lastReviewAt ?? this.lastReviewAt,
      appUpdated: appUpdated ?? this.appUpdated,
      reviewedTrustedDevices: reviewedTrustedDevices ?? this.reviewedTrustedDevices,
      reviewedConnectedDapps: reviewedConnectedDapps ?? this.reviewedConnectedDapps,
      emergencyNotificationsMuted: emergencyNotificationsMuted ?? this.emergencyNotificationsMuted,
    );
  }
}

@immutable
class SecuritySnapshot {
  const SecuritySnapshot({
    required this.score,
    required this.status,
    required this.backupComplete,
    required this.recoveryPhraseVerified,
    required this.biometricsEnabled,
    required this.pinEnabled,
    required this.activeSessions,
    required this.connectedDapps,
    required this.trustedDevices,
    required this.recentAlerts,
    required this.preferences,
    required this.checkSteps,
  });

  final int score;
  final SecurityStatus status;
  final bool backupComplete;
  final bool recoveryPhraseVerified;
  final bool biometricsEnabled;
  final bool pinEnabled;
  final List<ActiveSession> activeSessions;
  final List<ConnectedDapp> connectedDapps;
  final List<TrustedDevice> trustedDevices;
  final List<SecurityAlertItem> recentAlerts;
  final SecurityPreferences preferences;
  final List<SecurityCheckStep> checkSteps;
}

SecurityStatus securityStatusForScore(int score) {
  if (score >= 90) return SecurityStatus.excellent;
  if (score >= 75) return SecurityStatus.good;
  if (score >= 55) return SecurityStatus.fair;
  return SecurityStatus.needsAttention;
}
