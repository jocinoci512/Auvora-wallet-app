import '../release/integration_config.dart';

/// Hosted widget / partner onboarding helpers for fiat on-ramps.
///
/// Full SDK + KYC rails require merchant accounts. When ops compile in a
/// publishable key **and** set `ONRAMP_PARTNER_CHECKOUT_ENABLED=true`, Buy can
/// open the partner hosted checkout in an external browser.
abstract final class OnRampConfig {
  static const partnerOnboardingMessage =
      'Partner onboarding — MoonPay, Ramp, and Transak require Auvora merchant '
      'accounts, publishable API keys, and redirect URIs before live checkout. '
      'Until then, only Auvora preview simulates a buy on this device. '
      'Ops: see docs/API_AND_INTEGRATIONS_GUIDE.md.';

  static const partnerConfiguredPendingSdkMessage =
      'API key is compiled into this build, but in-app SDK checkout is not linked yet. '
      'Enable ONRAMP_PARTNER_CHECKOUT_ENABLED to open the partner hosted widget, '
      'or complete SDK onboarding for embedded flow.';

  static String unavailableReason(String code) {
    if (IntegrationConfig.partnerCheckoutReady(code)) {
      return 'Opens partner hosted checkout (external). KYC and settlement are handled by $code.';
    }
    if (IntegrationConfig.partnerKeyPresent(code)) {
      return partnerConfiguredPendingSdkMessage;
    }
    return 'Awaiting Auvora partner onboarding — no live checkout, KYC, or card charge. '
        'Use Auvora preview only.';
  }

  /// Hosted buy widget URL when a publishable key is present.
  static Uri? widgetUri({
    required String code,
    required String assetSymbol,
    required double fiatUsd,
    String walletAddress = '',
  }) {
    final amount = fiatUsd > 0 ? fiatUsd.toStringAsFixed(2) : '';
    final currency = _currencyCode(code, assetSymbol);
    switch (code) {
      case 'moonpay':
        if (!IntegrationConfig.moonPayConfigured) return null;
        return Uri.https('buy.moonpay.com', '/', {
          'apiKey': IntegrationConfig.moonPayApiKey,
          if (currency != null) 'currencyCode': currency,
          if (amount.isNotEmpty) 'baseCurrencyAmount': amount,
          'baseCurrencyCode': 'usd',
          if (walletAddress.isNotEmpty) 'walletAddress': walletAddress,
          'colorCode': '0D9488',
        });
      case 'ramp':
        if (!IntegrationConfig.rampConfigured) return null;
        return Uri.https('app.ramp.network', '/', {
          'hostApiKey': IntegrationConfig.rampApiKey,
          if (currency != null) 'swapAsset': currency,
          if (amount.isNotEmpty) 'fiatValue': amount,
          'fiatCurrency': 'USD',
          if (walletAddress.isNotEmpty) 'userAddress': walletAddress,
        });
      case 'transak':
        if (!IntegrationConfig.transakConfigured) return null;
        return Uri.https('global.transak.com', '/', {
          'apiKey': IntegrationConfig.transakApiKey,
          if (currency != null) 'cryptoCurrencyCode': currency,
          if (amount.isNotEmpty) 'fiatAmount': amount,
          'fiatCurrency': 'USD',
          if (walletAddress.isNotEmpty) 'walletAddress': walletAddress,
          'disableWalletAddressForm': walletAddress.isNotEmpty ? 'true' : 'false',
        });
      default:
        return null;
    }
  }

  static String? _currencyCode(String partner, String asset) {
    final upper = asset.toUpperCase();
    return switch (partner) {
      'moonpay' => switch (upper) {
          'BTC' => 'btc',
          'ETH' => 'eth',
          'SOL' => 'sol',
          'BNB' => 'bnb',
          'USDC' => 'usdc',
          'USDT' => 'usdt',
          'POL' || 'MATIC' => 'pol',
          'AVAX' => 'avax',
          'TRX' => 'trx',
          _ => upper.toLowerCase(),
        },
      'ramp' => switch (upper) {
          'BTC' => 'BTC_BTC',
          'ETH' => 'ETH_ETH',
          'SOL' => 'SOLANA_SOL',
          'USDC' => 'ETH_USDC',
          'MATIC' || 'POL' => 'MATIC_MATIC',
          _ => null,
        },
      'transak' => upper,
      _ => null,
    };
  }
}
