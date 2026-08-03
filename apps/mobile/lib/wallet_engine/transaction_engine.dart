import '../engine/models.dart';
import '../engine/quote_engine.dart';
import '../portfolio/models.dart';
import '../release/release_config.dart';
import 'blockchain_adapter.dart';
import 'models.dart';
import 'wallet_engine.dart';

class TransactionEngine {
  TransactionEngine({
    required WalletEngine walletEngine,
    required BlockchainLayer blockchainLayer,
  })  : _walletEngine = walletEngine,
        _blockchainLayer = blockchainLayer;

  final WalletEngine _walletEngine;
  final BlockchainLayer _blockchainLayer;

  Future<({PortfolioTx tx, TransactionSubmissionResult submission})> submitSend({
    required AssetHolding asset,
    required String to,
    required double amount,
    String? memo,
  }) async {
    final mnemonic = await _walletEngine.mnemonic();
    if (mnemonic == null) throw QuoteException('Wallet keys are unavailable on this device.');
    final fromAddress = _walletEngine.addressForNetwork(asset.network);
    if (fromAddress == null || fromAddress.isEmpty) {
      throw QuoteException('This network address is not ready yet. Try again after sync.');
    }
    final chain = ChainIdMeta.fromAssetNetwork(asset.network);
    final adapter = _blockchainLayer.adapterFor(chain);
    final fromRecord = WalletAddressRecord(
      chain: chain,
      address: fromAddress,
      derivationPath: 'preview',
    );
    final draft = await adapter.buildTransaction(
      from: fromRecord,
      toAddress: to,
      assetSymbol: asset.ticker,
      amount: amount,
      memo: memo,
    );
    final signed = await adapter.signTransaction(draft: draft, mnemonic: mnemonic);
    final submission = await adapter.broadcast(draft: draft, signedPayload: signed);
    _assertBroadcastGate(submission);
    final tx = PortfolioTx(
      id: submission.id,
      type: TxType.send,
      status: submission.status,
      network: asset.network,
      assetTicker: asset.ticker,
      amount: amount,
      amountUsd: amount * asset.priceUsd,
      timestamp: submission.submittedAt,
      from: fromAddress,
      to: to,
      hash: submission.hash,
      fee: draft.estimatedFee.networkFee,
      feeAsset: draft.estimatedFee.networkFeeAsset,
      note: submission.preview ? 'Preview · built through the multi-chain engine' : 'Sent from Auvora',
    );
    return (tx: tx, submission: submission);
  }

  Future<TransactionSubmissionResult> submitEngineQuote({
    required AssetQuote quote,
    required String walletAddress,
  }) async {
    final mnemonic = await _walletEngine.mnemonic();
    final chain = ChainIdMeta.fromAssetNetwork(quote.sourceNetwork);
    final adapter = _blockchainLayer.adapterFor(chain);
    final fromAddress = walletAddress.isNotEmpty
        ? walletAddress
        : (_walletEngine.addressForNetwork(quote.sourceNetwork) ?? '');
    if (quote.op == EngineOp.buy || quote.op == EngineOp.sell || mnemonic == null || fromAddress.isEmpty) {
      final fee = quote.fees.isEmpty
          ? const TransactionFeeEstimate(
              networkFee: 0,
              networkFeeAsset: 'USD',
              networkFeeUsd: 0,
              arrivalLabel: 'Preview only',
            )
          : TransactionFeeEstimate(
              networkFee: quote.fees.first.amount,
              networkFeeAsset: quote.fees.first.asset,
              networkFeeUsd: quote.fees.first.fiatUsd,
              arrivalLabel: quote.arrivalLabel,
            );
      return TransactionSubmissionResult(
        id: 'preview-${DateTime.now().millisecondsSinceEpoch}',
        hash: '0xpreview${DateTime.now().microsecondsSinceEpoch.toRadixString(16)}',
        status: TxStatus.pending,
        explorerUrl: fee.explorerBaseUrl ?? '',
        submittedAt: DateTime.now(),
        preview: true,
      );
    }
    final draft = await adapter.buildTransaction(
      from: WalletAddressRecord(chain: chain, address: fromAddress, derivationPath: 'preview'),
      toAddress: quote.destNetwork == null
          ? fromAddress
          : (_walletEngine.addressForNetwork(quote.destNetwork!) ?? fromAddress),
      assetSymbol: quote.fromAsset == 'USD' ? quote.toAsset : quote.fromAsset,
      amount: quote.fromAsset == 'USD' ? quote.toAmount : quote.fromAmount,
      memo: quote.routeSummary,
    );
    final signed = await adapter.signTransaction(draft: draft, mnemonic: mnemonic);
    final submission = await adapter.broadcast(draft: draft, signedPayload: signed);
    _assertBroadcastGate(submission);
    return submission;
  }

  /// Defense in depth: while the kill switch is off, adapters must return preview-only.
  void _assertBroadcastGate(TransactionSubmissionResult submission) {
    if (!ReleaseConfig.liveBroadcastEnabled && !submission.preview) {
      throw QuoteException(
        'Live broadcast is disabled (kill switch). Transfer was not submitted to the network.',
      );
    }
  }
}
