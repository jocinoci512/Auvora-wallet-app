import 'package:shared_preferences/shared_preferences.dart';

/// Explicit on-device preference schema versioning.
///
/// Secure vault keys (`auvora_mnemonic_v3_*`, `auvora_acct_*_v1`, …) are versioned
/// by key name and migrate inside [SecureKeyStore] / [AuthTokenStore].
/// Preference namespaces must also migrate — never assume a clean install after
/// Play / `adb install -r` updates.
abstract final class StorageSchema {
  static const int current = 1;
  static const _prefsKey = 'auvora_storage_schema_v';

  /// Runs forward-only preference migrations. Safe to call on every cold start.
  static Future<int> migrateIfNeeded() async {
    final prefs = await SharedPreferences.getInstance();
    final from = prefs.getInt(_prefsKey) ?? 0;
    var version = from;
    if (version < 1) {
      // v1: establish schema marker only. Existing prefs remain readable.
      version = 1;
    }
    if (version != from) {
      await prefs.setInt(_prefsKey, version);
    }
    return version;
  }
}
