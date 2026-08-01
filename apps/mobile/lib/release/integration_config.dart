/// Compile-time integration surface for Closed Beta / ops builds.
///
/// All secrets arrive via `--dart-define=KEY=value` (or CI secret injection).
/// Never commit real keys. Empty defaults keep public endpoints usable where
/// vendors allow anonymous access (CoinGecko / CoinCap / public RPCs).
///
/// See `docs/API_AND_INTEGRATIONS_GUIDE.md`.
abstract final class IntegrationConfig {
  // ── Market data ──────────────────────────────────────────────────────────

  static const String coinGeckoApiKey = String.fromEnvironment(
    'COINGECKO_API_KEY',
    defaultValue: '',
  );

  static const String coinCapApiKey = String.fromEnvironment(
    'COINCAP_API_KEY',
    defaultValue: '',
  );

  // ── WalletConnect / Reown ────────────────────────────────────────────────

  /// Project ID from https://cloud.reown.com (formerly cloud.walletconnect.com).
  static const String wcProjectId = String.fromEnvironment(
    'WC_PROJECT_ID',
    defaultValue: '',
  );

  static bool get hasWalletConnectProjectId => wcProjectId.trim().isNotEmpty;

  // ── Fiat on-ramp partners (publishable / public keys only in client) ─────

  static const String moonPayApiKey = String.fromEnvironment(
    'MOONPAY_API_KEY',
    defaultValue: '',
  );

  static const String rampApiKey = String.fromEnvironment(
    'RAMP_API_KEY',
    defaultValue: '',
  );

  static const String transakApiKey = String.fromEnvironment(
    'TRANSAK_API_KEY',
    defaultValue: '',
  );

  /// When true **and** a partner publishable key is present, Buy can open the
  /// partner hosted widget (external browser). Default false for Alpha safety.
  static const bool onRampPartnerCheckoutEnabled = bool.fromEnvironment(
    'ONRAMP_PARTNER_CHECKOUT_ENABLED',
    defaultValue: false,
  );

  static bool get moonPayConfigured => moonPayApiKey.trim().isNotEmpty;
  static bool get rampConfigured => rampApiKey.trim().isNotEmpty;
  static bool get transakConfigured => transakApiKey.trim().isNotEmpty;

  static bool partnerKeyPresent(String code) => switch (code) {
        'moonpay' => moonPayConfigured,
        'ramp' => rampConfigured,
        'transak' => transakConfigured,
        _ => false,
      };

  static bool partnerCheckoutReady(String code) =>
      onRampPartnerCheckoutEnabled && partnerKeyPresent(code);

  // ── RPC (public defaults + optional overrides / Alchemy) ─────────────────

  /// Optional Alchemy key — when set, EVM/Solana/TRON RPC URLs prefer Alchemy.
  static const String alchemyApiKey = String.fromEnvironment(
    'ALCHEMY_API_KEY',
    defaultValue: '',
  );

  static bool get hasAlchemyApiKey => alchemyApiKey.trim().isNotEmpty;

  static const String ethRpcUrl = String.fromEnvironment('ETH_RPC_URL', defaultValue: '');
  static const String ethRpcUrlBackup =
      String.fromEnvironment('ETH_RPC_URL_BACKUP', defaultValue: '');
  static const String polygonRpcUrl =
      String.fromEnvironment('POLYGON_RPC_URL', defaultValue: '');
  static const String polygonRpcUrlBackup =
      String.fromEnvironment('POLYGON_RPC_URL_BACKUP', defaultValue: '');
  static const String bscRpcUrl = String.fromEnvironment('BSC_RPC_URL', defaultValue: '');
  static const String bscRpcUrlBackup =
      String.fromEnvironment('BSC_RPC_URL_BACKUP', defaultValue: '');
  static const String solRpcUrl = String.fromEnvironment('SOL_RPC_URL', defaultValue: '');
  static const String solRpcUrlBackup =
      String.fromEnvironment('SOL_RPC_URL_BACKUP', defaultValue: '');
  static const String btcRpcUrl = String.fromEnvironment('BTC_RPC_URL', defaultValue: '');
  static const String btcRpcUrlBackup =
      String.fromEnvironment('BTC_RPC_URL_BACKUP', defaultValue: '');
  static const String tronRpcUrl = String.fromEnvironment('TRON_RPC_URL', defaultValue: '');
  static const String tronRpcUrlBackup =
      String.fromEnvironment('TRON_RPC_URL_BACKUP', defaultValue: '');

  /// Probe public / configured RPC URLs for diagnostics latency.
  /// Does **not** enable live broadcast (see [ReleaseConfig.liveBroadcastEnabled]).
  static const bool rpcHealthProbeEnabled = bool.fromEnvironment(
    'RPC_HEALTH_PROBE_ENABLED',
    defaultValue: true,
  );

  // ── Observability (hook only — no SDK until DSN provided + package linked) ─

  static const String sentryDsn = String.fromEnvironment(
    'SENTRY_DSN',
    defaultValue: '',
  );

  static bool get hasSentryDsn => sentryDsn.trim().isNotEmpty;

  /// Explicit opt-in; keeps crash reporting off even if a DSN is compiled in.
  static const bool sentryEnabled = bool.fromEnvironment(
    'SENTRY_ENABLED',
    defaultValue: false,
  );

  static bool get sentryReady => hasSentryDsn && sentryEnabled;

  // ── Diagnostics helpers (never expose secret values) ─────────────────────

  /// Redacted readiness map for diagnostics / About — booleans only.
  static Map<String, Object?> readinessSummary() => {
        'coinGeckoKey': coinGeckoApiKey.isNotEmpty,
        'coinCapKey': coinCapApiKey.isNotEmpty,
        'wcProjectId': hasWalletConnectProjectId,
        'alchemyKey': hasAlchemyApiKey,
        'moonPayKey': moonPayConfigured,
        'rampKey': rampConfigured,
        'transakKey': transakConfigured,
        'onRampPartnerCheckoutEnabled': onRampPartnerCheckoutEnabled,
        'rpcHealthProbeEnabled': rpcHealthProbeEnabled,
        'sentryDsnPresent': hasSentryDsn,
        'sentryEnabled': sentryEnabled,
        'sentryReady': sentryReady,
        'ethRpcOverride': ethRpcUrl.isNotEmpty,
        'solRpcOverride': solRpcUrl.isNotEmpty,
      };
}
