import 'package:flutter/foundation.dart';

import '../portfolio/models.dart';

enum AddressIssue {
  empty,
  invalid,
  wrongNetwork,
  badChecksum,
  unsupported,
}

@immutable
class ParsedPayment {
  const ParsedPayment({required this.address, this.embeddedAmount});
  final String address;
  final double? embeddedAmount;
}

@immutable
class AddressValidation {
  const AddressValidation._({
    required this.ok,
    this.issue,
    this.message,
    this.normalized,
    this.detectedNetwork,
    this.warning,
    this.embeddedAmount,
  });

  final bool ok;
  final AddressIssue? issue;
  final String? message;
  final String? normalized;
  final AssetNetwork? detectedNetwork;
  final String? warning;
  final double? embeddedAmount;

  static const empty = AddressValidation._(
    ok: false,
    issue: AddressIssue.empty,
    message: 'Enter a wallet address to continue.',
  );

  static bool isEvm(AssetNetwork n) =>
      n == AssetNetwork.ethereum || n == AssetNetwork.polygon || n == AssetNetwork.bnbSmartChain;

  /// True when this device can safely show a receive address for [network].
  static bool canReceiveOnDevice(AssetNetwork network) =>
      network == AssetNetwork.bitcoin ||
      network == AssetNetwork.solana ||
      network == AssetNetwork.tron ||
      isEvm(network);

  static ParsedPayment parsePaymentUri(String raw) {
    final input = raw.trim();
    if (input.isEmpty) return const ParsedPayment(address: '');

    final lower = input.toLowerCase();
    var address = input;
    double? amount;

    final schemeIdx = input.indexOf(':');
    if (schemeIdx > 0 && !input.startsWith('0x')) {
      final scheme = lower.substring(0, schemeIdx);
      if (scheme == 'ethereum' ||
          scheme == 'bitcoin' ||
          scheme == 'solana' ||
          scheme == 'tron' ||
          scheme == 'bnb' ||
          scheme == 'binance' ||
          scheme == 'polygon') {
        final rest = input.substring(schemeIdx + 1);
        final parts = rest.split('?');
        address = parts.first.trim();
        if (parts.length > 1) {
          final query = Uri.splitQueryString(parts[1]);
          final amt = query['amount'] ?? query['value'];
          if (amt != null) amount = double.tryParse(amt);
        }
      }
    }

    address = address.replaceAll(RegExp(r'\s+'), '').replaceAll('\u200b', '');
    return ParsedPayment(address: address, embeddedAmount: amount);
  }

  static AddressValidation validate(String raw, {required AssetNetwork expected}) {
    final parsed = parsePaymentUri(raw);
    final input = parsed.address;
    if (input.isEmpty) return empty;

    final detected = detectNetwork(input);
    if (detected == null) {
      return const AddressValidation._(
        ok: false,
        issue: AddressIssue.invalid,
        message: 'That doesn’t look like a wallet address. Check for missing or extra characters.',
      );
    }

    if (detected != expected) {
      final bothEvm = isEvm(detected) && isEvm(expected);
      if (!bothEvm) {
        return AddressValidation._(
          ok: false,
          issue: AddressIssue.wrongNetwork,
          detectedNetwork: detected,
          message:
              'This address looks like ${detected.label}, but you’re sending on ${expected.label}. Switch networks to avoid lost funds.',
        );
      }
    }

    if (isEvm(detected)) {
      if (!RegExp(r'^0x[a-fA-F0-9]{40}$').hasMatch(input)) {
        return const AddressValidation._(
          ok: false,
          issue: AddressIssue.invalid,
          message: 'That Ethereum-style address isn’t the right length.',
        );
      }
      final body = input.substring(2);
      final lower = body.toLowerCase();
      final upper = body.toUpperCase();
      final mixed = body != lower && body != upper;
      final normalized = '0x$lower';
      return AddressValidation._(
        ok: true,
        normalized: normalized,
        detectedNetwork: expected,
        embeddedAmount: parsed.embeddedAmount,
        warning: mixed
            ? 'We standardized this address to lowercase. Confirm the last 6 characters still match your source: …${normalized.substring(normalized.length - 6)}'
            : 'Confirm the last 6 characters: …${normalized.substring(normalized.length - 6)}',
      );
    }

    return AddressValidation._(
      ok: true,
      normalized: input,
      detectedNetwork: detected,
      embeddedAmount: parsed.embeddedAmount,
      warning: input.length > 8
          ? 'Confirm the last characters: …${input.substring(input.length - 6)}'
          : null,
    );
  }

  static AssetNetwork? detectNetwork(String input) {
    final v = input.trim();
    if (RegExp(r'^0x[a-fA-F0-9]{40}$').hasMatch(v)) {
      return AssetNetwork.ethereum;
    }
    if (RegExp(r'^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,89}$').hasMatch(v)) {
      return AssetNetwork.bitcoin;
    }
    if (RegExp(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$').hasMatch(v) && !v.startsWith('0x')) {
      if (v.startsWith('1') || v.startsWith('3') || v.toLowerCase().startsWith('bc1')) {
        return AssetNetwork.bitcoin;
      }
      if (v.startsWith('T') && v.length >= 34) {
        return AssetNetwork.tron;
      }
      return AssetNetwork.solana;
    }
    return null;
  }

  static bool looksLikeSameWallet(String a, String b) {
    final pa = parsePaymentUri(a).address.toLowerCase();
    final pb = parsePaymentUri(b).address.toLowerCase();
    return pa.isNotEmpty && pa == pb;
  }
}

class FeeEstimate {
  const FeeEstimate({
    required this.feeCrypto,
    required this.feeUsd,
    required this.feeAsset,
    required this.arrivalLabel,
  });

  final double feeCrypto;
  final double feeUsd;
  final String feeAsset;
  final String arrivalLabel;
}

FeeEstimate estimateFee({
  required AssetHolding asset,
  required double amount,
}) {
  switch (asset.network) {
    case AssetNetwork.bitcoin:
      return FeeEstimate(
        feeCrypto: 0.00012,
        feeUsd: 0.00012 * asset.priceUsd,
        feeAsset: 'BTC',
        arrivalLabel: 'About 10–40 minutes',
      );
    case AssetNetwork.solana:
      return FeeEstimate(
        feeCrypto: 0.00005,
        feeUsd: 0.00005 * (asset.ticker == 'SOL' ? asset.priceUsd : 148),
        feeAsset: 'SOL',
        arrivalLabel: 'Usually under a minute',
      );
    case AssetNetwork.bnbSmartChain:
      return const FeeEstimate(
        feeCrypto: 0.0003,
        feeUsd: 0.18,
        feeAsset: 'BNB',
        arrivalLabel: 'Usually under a minute',
      );
    case AssetNetwork.tron:
      return const FeeEstimate(
        feeCrypto: 1.25,
        feeUsd: 0.16,
        feeAsset: 'TRX',
        arrivalLabel: 'Usually under a minute',
      );
    case AssetNetwork.polygon:
      return const FeeEstimate(
        feeCrypto: 0.02,
        feeUsd: 0.0084,
        feeAsset: 'POL',
        arrivalLabel: 'Usually under 2 minutes',
      );
    case AssetNetwork.ethereum:
      final fee = asset.ticker == 'USDC' ? 0.0018 : 0.0012;
      return FeeEstimate(
        feeCrypto: fee,
        feeUsd: fee * (asset.ticker == 'ETH' ? asset.priceUsd : 3240),
        feeAsset: 'ETH',
        arrivalLabel: 'Usually 1–3 minutes',
      );
  }
}
