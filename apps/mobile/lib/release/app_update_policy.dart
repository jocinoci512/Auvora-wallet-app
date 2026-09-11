import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../account/auvora_api_config.dart';
import 'release_config.dart';

/// Remote + local app update policy for Auvora Wallet.
///
/// Fail-open on network errors: never brick the wallet because the policy
/// endpoint is briefly unavailable. A hard minimum from a successful response
/// can require a Store update without wiping customer data.
@immutable
class AppVersionPolicy {
  const AppVersionPolicy({
    required this.minimumSupportedVersionCode,
    required this.latestRecommendedVersionCode,
    required this.storeUrl,
    this.message,
  });

  final int minimumSupportedVersionCode;
  final int latestRecommendedVersionCode;
  final String storeUrl;
  final String? message;

  static const AppVersionPolicy defaults = AppVersionPolicy(
    minimumSupportedVersionCode: 1,
    latestRecommendedVersionCode: 32,
    storeUrl: 'https://play.google.com/store/apps/details?id=com.auvora.auvora_wallet',
    message: null,
  );

  factory AppVersionPolicy.fromJson(Map<String, Object?> json) {
    return AppVersionPolicy(
      minimumSupportedVersionCode:
          (json['minimumSupportedVersionCode'] as num?)?.toInt() ??
              defaults.minimumSupportedVersionCode,
      latestRecommendedVersionCode:
          (json['latestRecommendedVersionCode'] as num?)?.toInt() ??
              defaults.latestRecommendedVersionCode,
      storeUrl: (json['storeUrl'] as String?)?.trim().isNotEmpty == true
          ? (json['storeUrl'] as String).trim()
          : defaults.storeUrl,
      message: json['message'] as String?,
    );
  }
}

enum AppUpdateUrgency { none, optional, required }

@immutable
class AppUpdateDecision {
  const AppUpdateDecision({
    required this.urgency,
    required this.policy,
    required this.installedVersionCode,
    required this.installedVersionName,
  });

  final AppUpdateUrgency urgency;
  final AppVersionPolicy policy;
  final int installedVersionCode;
  final String installedVersionName;

  String get requiredMessage =>
      policy.message?.trim().isNotEmpty == true
          ? policy.message!.trim()
          : 'A newer version of Auvora Wallet is required to continue.';
}

abstract final class AppUpdatePolicyService {
  static const _dismissOptionalUntilKey = 'auvora_update_optional_dismiss_until_ms';
  static const _optionalCooldown = Duration(days: 7);

  /// Resolve installed build numbers from [ReleaseConfig] (synced to pubspec +N).
  static Future<({int code, String name})> installedVersion() async {
    return (
      code: ReleaseConfig.versionCode,
      name: ReleaseConfig.marketingVersion,
    );
  }

  static Future<AppVersionPolicy> fetchPolicy({http.Client? client}) async {
    if (!AuvoraApiConfig.isConfigured) return AppVersionPolicy.defaults;
    final c = client ?? http.Client();
    final owned = client == null;
    try {
      final uri = AuvoraApiConfig.endpoint('/api/v1/mobile/app-version-policy');
      final res = await c.get(uri).timeout(const Duration(seconds: 8));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return AppVersionPolicy.defaults;
      }
      final decoded = jsonDecode(res.body);
      if (decoded is! Map) return AppVersionPolicy.defaults;
      return AppVersionPolicy.fromJson(Map<String, Object?>.from(decoded));
    } catch (_) {
      return AppVersionPolicy.defaults;
    } finally {
      if (owned) c.close();
    }
  }

  static Future<AppUpdateDecision> evaluate({http.Client? client}) async {
    final installed = await installedVersion();
    final policy = await fetchPolicy(client: client);
    if (installed.code < policy.minimumSupportedVersionCode) {
      return AppUpdateDecision(
        urgency: AppUpdateUrgency.required,
        policy: policy,
        installedVersionCode: installed.code,
        installedVersionName: installed.name,
      );
    }
    if (installed.code < policy.latestRecommendedVersionCode) {
      final prefs = await SharedPreferences.getInstance();
      final until = prefs.getInt(_dismissOptionalUntilKey) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      if (now < until) {
        return AppUpdateDecision(
          urgency: AppUpdateUrgency.none,
          policy: policy,
          installedVersionCode: installed.code,
          installedVersionName: installed.name,
        );
      }
      return AppUpdateDecision(
        urgency: AppUpdateUrgency.optional,
        policy: policy,
        installedVersionCode: installed.code,
        installedVersionName: installed.name,
      );
    }
    return AppUpdateDecision(
      urgency: AppUpdateUrgency.none,
      policy: policy,
      installedVersionCode: installed.code,
      installedVersionName: installed.name,
    );
  }

  static Future<void> dismissOptionalNotice() async {
    final prefs = await SharedPreferences.getInstance();
    final until = DateTime.now().add(_optionalCooldown).millisecondsSinceEpoch;
    await prefs.setInt(_dismissOptionalUntilKey, until);
  }
}
