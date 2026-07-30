import 'dart:math';

import '../crypto/wallet_crypto.dart';
import '../portfolio/models.dart';
import 'models.dart';

abstract class BlockchainAdapter {
  ChainId get chain;
  String get providerCode;

  WalletAddressRecord deriveAddress({
    required String mnemonic,
    required int accountIndex,
  });

  Future<double> getBalance({
    required WalletAddressRecord address,
    required String assetSymbol,
  });

  Future<List<PortfolioTx>> getHistory({
    required WalletAddressRecord address,
  });

  Future<TransactionFeeEstimate> estimateFee({
    required WalletAddressRecord from,
    required String assetSymbol,
    required double amount,
  });

  Future<TransactionDraft> buildTransaction({
    required WalletAddressRecord from,
    required String toAddress,
    required String assetSymbol,
    required double amount,
    String? memo,
  });

  Future<String> signTransaction({
    required TransactionDraft draft,
    required String mnemonic,
  });

  Future<TransactionSubmissionResult> broadcast({
    required TransactionDraft draft,
    required String signedPayload,
  });

  Future<EndpointHealth> ping();
}

class BlockchainLayer {
  BlockchainLayer({required List<BlockchainAdapter> adapters})
      : _adapters = {for (final adapter in adapters) adapter.chain: adapter};

  final Map<ChainId, BlockchainAdapter> _adapters;

  List<ChainId> get supportedChains => _adapters.keys.toList(growable: false);

  BlockchainAdapter adapterFor(ChainId chain) {
    final adapter = _adapters[chain];
    if (adapter == null) {
      throw StateError('No blockchain adapter registered for ${chain.label}.');
    }
    return adapter;
  }

  Iterable<BlockchainAdapter> get adapters => _adapters.values;
}

class PreviewBlockchainAdapter implements BlockchainAdapter {
  PreviewBlockchainAdapter({
    required this.chain,
    required this.providerCode,
    required this.explorerBaseUrl,
  });

  @override
  final ChainId chain;

  @override
  final String providerCode;

  final String explorerBaseUrl;

  @override
  WalletAddressRecord deriveAddress({
    required String mnemonic,
    required int accountIndex,
  }) {
    final path = switch (chain) {
      ChainId.bitcoin => "m/84'/0'/$accountIndex'/0/0",
      ChainId.ethereum => "m/44'/60'/$accountIndex'/0/0",
      ChainId.solana => "m/44'/501'/$accountIndex'/0'",
      ChainId.bnbSmartChain => "m/44'/60'/$accountIndex'/0/1",
      ChainId.tron => "m/44'/195'/$accountIndex'/0/0",
      ChainId.polygon => "m/44'/966'/$accountIndex'/0/0",
    };
    return WalletAddressRecord(
      chain: chain,
      address: WalletCrypto.deriveAddressForNetwork(mnemonic, chain.assetNetwork, index: accountIndex),
      derivationPath: path,
      label: '${chain.label} main',
    );
  }

  @override
  Future<double> getBalance({
    required WalletAddressRecord address,
    required String assetSymbol,
  }) async {
    final seed = address.address.hashCode.abs() + assetSymbol.hashCode.abs();
    final base = (seed % 1000) / 100;
    return switch (assetSymbol) {
      'BTC' => (base / 10).clamp(0.01, 0.75),
      'ETH' => base.clamp(0.2, 12.0),
      'SOL' => (base * 8).clamp(2.0, 240.0),
      'USDC' => (base * 120).clamp(120.0, 3200.0),
      'BNB' => (base / 2).clamp(0.05, 6.0),
      'TRX' => (base * 900).clamp(500.0, 18000.0),
      'POL' => (base * 140).clamp(10.0, 1400.0),
      _ => base,
    }.toDouble();
  }

  @override
  Future<List<PortfolioTx>> getHistory({
    required WalletAddressRecord address,
  }) async {
    final now = DateTime.now();
    final hash = WalletCrypto.shortHash('${address.address}:${chain.key}');
    return [
      PortfolioTx(
        id: '${chain.key}-rx',
        type: TxType.receive,
        status: TxStatus.completed,
        network: chain.assetNetwork,
        assetTicker: chain.nativeTicker,
        amount: chain == ChainId.tron ? 640 : 0.42,
        amountUsd: chain == ChainId.tron ? 85 : 1360,
        timestamp: now.subtract(const Duration(hours: 6)),
        from: 'Preview source',
        to: WalletCrypto.compactAddress(address.address),
        hash: hash,
        note: 'Preview synchronized activity',
      ),
    ];
  }

  @override
  Future<TransactionFeeEstimate> estimateFee({
    required WalletAddressRecord from,
    required String assetSymbol,
    required double amount,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 70));
    return switch (chain) {
      ChainId.bitcoin => const TransactionFeeEstimate(
          networkFee: 0.00012,
          networkFeeAsset: 'BTC',
          networkFeeUsd: 7.4,
          arrivalLabel: 'About 10–40 minutes',
          explorerBaseUrl: 'https://mempool.space/tx/',
        ),
      ChainId.solana => const TransactionFeeEstimate(
          networkFee: 0.00005,
          networkFeeAsset: 'SOL',
          networkFeeUsd: 0.01,
          arrivalLabel: 'Usually under a minute',
          explorerBaseUrl: 'https://solscan.io/tx/',
        ),
      ChainId.bnbSmartChain => const TransactionFeeEstimate(
          networkFee: 0.0003,
          networkFeeAsset: 'BNB',
          networkFeeUsd: 0.18,
          arrivalLabel: 'Usually under a minute',
          explorerBaseUrl: 'https://bscscan.com/tx/',
        ),
      ChainId.tron => const TransactionFeeEstimate(
          networkFee: 1.25,
          networkFeeAsset: 'TRX',
          networkFeeUsd: 0.16,
          arrivalLabel: 'Usually under a minute',
          explorerBaseUrl: 'https://tronscan.org/#/transaction/',
        ),
      ChainId.polygon => const TransactionFeeEstimate(
          networkFee: 0.02,
          networkFeeAsset: 'POL',
          networkFeeUsd: 0.01,
          arrivalLabel: 'Usually under 2 minutes',
          explorerBaseUrl: 'https://polygonscan.com/tx/',
        ),
      ChainId.ethereum => const TransactionFeeEstimate(
          networkFee: 0.0012,
          networkFeeAsset: 'ETH',
          networkFeeUsd: 3.9,
          arrivalLabel: 'Usually 1–3 minutes',
          explorerBaseUrl: 'https://etherscan.io/tx/',
        ),
    };
  }

  @override
  Future<TransactionDraft> buildTransaction({
    required WalletAddressRecord from,
    required String toAddress,
    required String assetSymbol,
    required double amount,
    String? memo,
  }) async {
    final fee = await estimateFee(from: from, assetSymbol: assetSymbol, amount: amount);
    return TransactionDraft(
      chain: chain,
      fromAddress: from.address,
      toAddress: toAddress,
      assetSymbol: assetSymbol,
      amount: amount,
      memo: memo,
      estimatedFee: fee,
      unsignedPayload: 'preview:${chain.key}:${from.address}:$toAddress:$assetSymbol:$amount',
    );
  }

  @override
  Future<String> signTransaction({
    required TransactionDraft draft,
    required String mnemonic,
  }) async {
    // Preview signature — never include mnemonic material in the digest.
    return 'signed:${WalletCrypto.shortHash('${draft.fromAddress}:${draft.unsignedPayload}')}:preview';
  }

  @override
  Future<TransactionSubmissionResult> broadcast({
    required TransactionDraft draft,
    required String signedPayload,
  }) async {
    final hash = WalletCrypto.shortHash('${draft.unsignedPayload}:$signedPayload:${DateTime.now().microsecondsSinceEpoch}');
    return TransactionSubmissionResult(
      id: '${chain.key}-${DateTime.now().millisecondsSinceEpoch}',
      hash: hash,
      status: TxStatus.pending,
      explorerUrl: '$explorerBaseUrl$hash',
      submittedAt: DateTime.now(),
      preview: true,
    );
  }

  @override
  Future<EndpointHealth> ping() async {
    final rng = Random(chain.index + 7);
    final latency = 80 + rng.nextInt(110);
    final state = latency > 160 ? EndpointState.degraded : EndpointState.healthy;
    return EndpointHealth(
      chain: chain,
      endpoint: '$providerCode.${chain.key}.preview',
      latencyMs: latency,
      state: state,
      lastCheckedAt: DateTime.now(),
      failoverCount: state == EndpointState.degraded ? 1 : 0,
    );
  }
}
