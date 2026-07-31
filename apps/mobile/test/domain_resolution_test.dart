import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/transfer/domain_resolution.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final resolver = PreviewDomainResolver();

  test('detects name-like recipients', () {
    expect(resolver.isNameLike('vitalik.eth'), isTrue);
    expect(resolver.isNameLike('alice.crypto'), isTrue);
    expect(resolver.isNameLike('0xabc'), isFalse);
    expect(resolver.isNameLike('plain'), isFalse);
  });

  test('preview resolve returns deterministic address', () async {
    final a = await resolver.resolve('demo.eth', network: AssetNetwork.ethereum);
    final b = await resolver.resolve('demo.eth', network: AssetNetwork.ethereum);
    expect(a.ok, isTrue);
    expect(a.address, startsWith('0x'));
    expect(a.address, b.address);
    expect(a.previewOnly, isTrue);
  });

  test('risk assessment flags burn address', () {
    final risk = assessAddressRisk('0x0000000000000000000000000000000000000000');
    expect(risk.level, AddressRiskLevel.high);
    expect(risk.reasons, isNotEmpty);
  });
}
