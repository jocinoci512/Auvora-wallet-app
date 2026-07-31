import 'package:flutter/foundation.dart';

import '../portfolio/models.dart';

/// Domain-name resolution port (ENS / Unstoppable-style).
/// Production should swap [PreviewDomainResolver] for a live provider.
abstract class DomainResolver {
  String get id;

  bool isNameLike(String value);

  Future<DomainResolveResult> resolve(String name, {required AssetNetwork network});
}

@immutable
class DomainResolveResult {
  const DomainResolveResult({
    required this.ok,
    this.address,
    this.providerLabel,
    this.message,
    this.previewOnly = true,
  });

  final bool ok;
  final String? address;
  final String? providerLabel;
  final String? message;
  final bool previewOnly;
}

class PreviewDomainResolver implements DomainResolver {
  static const _udTlds = {
    'crypto',
    'nft',
    'wallet',
    'x',
    'dao',
    'blockchain',
    'bitcoin',
    'polygon',
  };

  static final _nameLike = RegExp(
    r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$',
    caseSensitive: false,
  );

  @override
  String get id => 'preview-domain';

  @override
  bool isNameLike(String value) {
    final a = value.trim();
    if (a.isEmpty || a.startsWith('0x') || !a.contains('.')) return false;
    return _nameLike.hasMatch(a);
  }

  @override
  Future<DomainResolveResult> resolve(String name, {required AssetNetwork network}) async {
    final n = name.trim().toLowerCase();
    if (!isNameLike(n)) {
      return const DomainResolveResult(ok: false, message: 'Enter a valid ENS or domain name.');
    }
    if (network != AssetNetwork.ethereum &&
        network != AssetNetwork.polygon &&
        network != AssetNetwork.bnbSmartChain) {
      return const DomainResolveResult(
        ok: false,
        message: 'Domain names are supported on Ethereum, Polygon, and BNB for now.',
      );
    }
    final tld = n.split('.').last;
    final provider = _udTlds.contains(tld) ? 'Unstoppable Domains' : 'ENS';
    var h = 0;
    for (final code in n.codeUnits) {
      h = (h * 31 + code) & 0xffffffff;
    }
    final hex = ('${h.toRadixString(16)}a1b2c3d4e5f67890abcdef0123456789').substring(0, 40);
    return DomainResolveResult(
      ok: true,
      address: '0x$hex',
      providerLabel: provider,
      previewOnly: true,
      message: 'Demo resolve only — not a live $provider lookup.',
    );
  }
}

/// Client-side education heuristics (never blocks a valid address alone).
@immutable
class AddressRiskAssessment {
  const AddressRiskAssessment({required this.level, required this.reasons});

  final AddressRiskLevel level;
  final List<String> reasons;
}

enum AddressRiskLevel { ok, warn, high }

AddressRiskAssessment assessAddressRisk(String address) {
  final reasons = <String>[];
  final a = address.trim();
  if (a.isEmpty) return const AddressRiskAssessment(level: AddressRiskLevel.ok, reasons: []);

  final body = a.toLowerCase().replaceFirst(RegExp(r'^0x'), '');
  if (RegExp(r'^0+$').hasMatch(body) || a.toLowerCase() == '0x0000000000000000000000000000000000000000') {
    reasons.add('Looks like a null / burn address');
  }
  if (a.length < 20) {
    reasons.add('Address is unusually short');
  }
  if (RegExp(r'[IlO0]{6,}').hasMatch(a)) {
    reasons.add('Homoglyph-heavy characters — double-check carefully');
  }
  if (RegExp(r'test|fake|example', caseSensitive: false).hasMatch(a)) {
    reasons.add('Contains placeholder-like text');
  }

  final level = reasons.any((r) => r.contains('null') || r.contains('burn') || r.contains('placeholder'))
      ? AddressRiskLevel.high
      : reasons.isNotEmpty
          ? AddressRiskLevel.warn
          : AddressRiskLevel.ok;
  return AddressRiskAssessment(level: level, reasons: reasons);
}
