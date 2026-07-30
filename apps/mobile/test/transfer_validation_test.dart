import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/transfer/address_validation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('validates ethereum address for ethereum send', () {
    final v = AddressValidation.validate(
      '0x8f3a21b9c4d5e6f708192a3b4c5d6e7f8191c2d3',
      expected: AssetNetwork.ethereum,
    );
    expect(v.ok, isTrue);
    expect(v.normalized, startsWith('0x'));
  });

  test('rejects bitcoin address on ethereum send with plain language', () {
    final v = AddressValidation.validate(
      'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      expected: AssetNetwork.ethereum,
    );
    expect(v.ok, isFalse);
    expect(v.message, contains('Bitcoin'));
    expect(v.message, contains('Ethereum'));
  });

  test('allows evm address on polygon', () {
    final v = AddressValidation.validate(
      '0x8f3a21b9c4d5e6f708192a3b4c5d6e7f8191c2d3',
      expected: AssetNetwork.polygon,
    );
    expect(v.ok, isTrue);
  });

  test('parses ethereum payment URI with amount', () {
    final p = AddressValidation.parsePaymentUri(
      'ethereum:0x8f3a21b9c4d5e6f708192a3b4c5d6e7f8191c2d3?amount=1.5',
    );
    expect(p.address.toLowerCase(), contains('0x8f3a'));
    expect(p.embeddedAmount, 1.5);
  });

  test('strips whitespace from pasted addresses', () {
    final p = AddressValidation.parsePaymentUri(' 0x8f3a21b9c4d5e6f708192a3b4c5d6e7f8191c2d3\n');
    expect(p.address.length, 42);
  });

  test('receive safety allows supported multi-chain networks on device', () {
    expect(AddressValidation.canReceiveOnDevice(AssetNetwork.ethereum), isTrue);
    expect(AddressValidation.canReceiveOnDevice(AssetNetwork.bitcoin), isTrue);
    expect(AddressValidation.canReceiveOnDevice(AssetNetwork.solana), isTrue);
    expect(AddressValidation.canReceiveOnDevice(AssetNetwork.tron), isTrue);
    expect(AddressValidation.canReceiveOnDevice(AssetNetwork.polygon), isTrue);
    expect(AddressValidation.canReceiveOnDevice(AssetNetwork.bnbSmartChain), isTrue);
  });

  test('detects empty address', () {
    expect(AddressValidation.validate('  ', expected: AssetNetwork.solana).ok, isFalse);
  });

  test('fee estimate includes arrival label', () {
    const asset = AssetHolding(
      id: 'eth',
      name: 'Ethereum',
      ticker: 'ETH',
      network: AssetNetwork.ethereum,
      balance: 1,
      priceUsd: 3000,
      change24hPct: 1,
      color: 0xFF000000,
    );
    final fee = estimateFee(asset: asset, amount: 0.1);
    expect(fee.arrivalLabel, isNotEmpty);
    expect(fee.feeCrypto, greaterThan(0));
  });
}
