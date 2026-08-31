import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/transfer/address_validation.dart';
import 'package:auvora_wallet/wallet_engine/evm_live_fee_quote.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('live fee vs legacy static path', () {
    test('legacy estimateFee still returns 0.0012 for Ethereum (offline fallback only)', () {
      final fee = estimateFee(
        asset: const AssetHolding(
          id: 'eth',
          name: 'Ethereum',
          ticker: 'ETH',
          network: AssetNetwork.ethereum,
          balance: 1,
          priceUsd: 0,
          change24hPct: 0,
          color: 0xFF627EEA,
        ),
        amount: 0.0001,
      );
      expect(fee.feeCrypto, closeTo(0.0012, 1e-9));
      expect(fee.isLive, isFalse);
    });

    test('canonical live quote never equals legacy 0.0012 for Anvil gas', () {
      final quote = EvmLiveFeeQuote.fromGasPrice(
        gasPriceWei: BigInt.from(1000000007),
        gasLimit: 21000,
      );
      expect(quote.feeNative, closeTo(0.000021000000147, 1e-15));
      expect(quote.feeNative, isNot(closeTo(0.0012, 1e-4)));
      expect(quote.isLive, isTrue);
    });

    test('failed live quote marker is rpcUnavailable, not silent 0.0012', () {
      final failed = FeeEstimate(
        feeCrypto: 0,
        feeUsd: 0,
        feeAsset: 'QA ETH',
        arrivalLabel: 'Network fee unavailable — reconnect and refresh',
        speed: FeeSpeed.standard,
        isLive: false,
        rpcUnavailable: true,
      );
      expect(failed.rpcUnavailable, isTrue);
      expect(failed.isLive, isFalse);
      expect(failed.feeCrypto, isNot(closeTo(0.0012, 1e-4)));
    });

    test('gas refresh changes displayed fee when gas price changes', () {
      final a = EvmLiveFeeQuote.fromGasPrice(
        gasPriceWei: BigInt.from(1000000007),
        gasLimit: 21000,
      );
      final b = EvmLiveFeeQuote.fromGasPrice(
        gasPriceWei: BigInt.from(2000000014),
        gasLimit: 21000,
      );
      expect(a.feeWei, isNot(equals(b.feeWei)));
      expect(EvmLiveFeeQuote.formatNativeAmount(a.feeNative), '0.000021');
      expect(EvmLiveFeeQuote.formatNativeAmount(b.feeNative), '0.000042');
    });

    test('signer inputs match quote gas fields', () {
      final quote = EvmLiveFeeQuote.fromGasPrice(
        gasPriceWei: BigInt.from(1000000007),
        gasLimit: 21000,
      );
      final confirmed = TransactionFeeEstimate(
        networkFee: quote.feeNative,
        networkFeeAsset: quote.feeAssetLabel,
        networkFeeUsd: 0,
        arrivalLabel: '~15 sec',
        gasPriceWei: quote.gasPriceWei,
        gasLimit: quote.gasLimit,
        isLive: true,
      );
      expect(confirmed.gasPriceWei, quote.gasPriceWei);
      expect(confirmed.gasLimit, quote.gasLimit);
      expect(confirmed.networkFee, quote.feeNative);
      expect(confirmed.isLive, isTrue);
    });
  });
}
