import 'dart:convert';

import '../connections/solana_local_signer.dart';
import '../crypto/wallet_crypto.dart';
import '../portfolio/models.dart';
import '../release/auvora_qa_local_solana.dart';
import '../release/network_env.dart';
import '../release/release_config.dart';
import 'blockchain_adapter.dart';
import 'models.dart';
import 'rpc_endpoints.dart';
import 'solana_json_rpc.dart';
import 'solana_testnet_broadcast.dart';

class SolanaRpcBlockchainAdapter implements BlockchainAdapter {
  SolanaRpcBlockchainAdapter({
    required this.providerCode,
    required this.explorerBaseUrl,
    SolanaJsonRpcClient? rpcClient,
  }) : _rpc = rpcClient ?? SolanaJsonRpcClient();

  @override
  ChainId get chain => ChainId.solana;

  @override
  final String providerCode;

  final String explorerBaseUrl;
  final SolanaJsonRpcClient _rpc;

  @override
  WalletAddressRecord deriveAddress({
    required String mnemonic,
    required int accountIndex,
  }) {
    return WalletAddressRecord(
      chain: chain,
      address: WalletCrypto.deriveAddressForNetwork(
        mnemonic,
        AssetNetwork.solana,
        index: accountIndex,
      ),
      derivationPath: WalletCrypto.derivationPathFor(
        AssetNetwork.solana,
        accountIndex: accountIndex,
      ),
      label: AuvoraNetworkEnv.displayName(AssetNetwork.solana),
    );
  }

  @override
  Future<double> getBalance({
    required WalletAddressRecord address,
    required String assetSymbol,
  }) async {
    if (assetSymbol.toUpperCase() != 'SOL') {
      throw SolanaRpcException(
          'Token balance RPC not available for $assetSymbol.');
    }
    final lamports = await _rpc.getBalance(_rpcUrl, address.address);
    return lamports / 1000000000;
  }

  @override
  Future<List<PortfolioTx>> getHistory({
    required WalletAddressRecord address,
  }) async {
    return const [];
  }

  @override
  Future<TransactionFeeEstimate> estimateFee({
    required WalletAddressRecord from,
    required String assetSymbol,
    required double amount,
  }) async {
    if (SolanaTestnetBroadcast.enabledNow && AuvoraQaLocalSolana.isActive) {
      final latest = await _rpc.getLatestBlockhash(_rpcUrl);
      final message = SolanaLocalSigner.buildTransferMessage(
        fromAddress: from.address,
        toAddress: AuvoraQaLocalSolana.controlledRecipient,
        recentBlockhash: latest.blockhash,
        lamports: _solToLamports(amount),
      );
      final feeLamports =
          await _rpc.getFeeForMessage(_rpcUrl, base64Encode(message));
      return TransactionFeeEstimate(
        networkFee: feeLamports / 1000000000,
        networkFeeAsset: AuvoraQaLocalSolana.feeAssetLabel,
        networkFeeUsd: 0,
        arrivalLabel: 'Usually under a minute',
        explorerBaseUrl: explorerBaseUrl,
        isLive: true,
      );
    }
    return TransactionFeeEstimate(
      networkFee:
          SolanaJsonRpcClient.simpleTransferFallbackFeeLamports / 1000000000,
      networkFeeAsset: AuvoraQaLocalSolana.isActive ? 'QA SOL' : 'SOL',
      networkFeeUsd: 0,
      arrivalLabel: 'Usually under a minute',
      explorerBaseUrl: explorerBaseUrl,
      isLive: false,
    );
  }

  @override
  Future<TransactionDraft> buildTransaction({
    required WalletAddressRecord from,
    required String toAddress,
    required String assetSymbol,
    required double amount,
    String? memo,
  }) async {
    final fee =
        await estimateFee(from: from, assetSymbol: assetSymbol, amount: amount);
    final latest = await _rpc.getLatestBlockhash(_rpcUrl);
    final payload = jsonEncode({
      'type': 'solana-system-transfer',
      'from': from.address,
      'to': toAddress,
      'lamports': _solToLamports(amount),
      'recentBlockhash': latest.blockhash,
      'lastValidBlockHeight': latest.lastValidBlockHeight,
    });
    return TransactionDraft(
      chain: chain,
      fromAddress: from.address,
      toAddress: toAddress,
      assetSymbol: assetSymbol,
      amount: amount,
      memo: memo,
      estimatedFee: fee,
      unsignedPayload: payload,
    );
  }

  @override
  Future<String> signTransaction({
    required TransactionDraft draft,
    required String mnemonic,
  }) async {
    if (!SolanaTestnetBroadcast.enabledNow) {
      return 'signed:${WalletCrypto.shortHash('${draft.fromAddress}:${draft.unsignedPayload}')}:local';
    }
    SolanaTestnetBroadcast.assertAllowed(
      canBroadcastTestnet: ReleaseConfig.canBroadcastTestnet,
      liveBroadcastEnabled: ReleaseConfig.liveBroadcastEnabled,
      isTestnetEnv: AuvoraNetworkEnv.isTestnet,
      rpcUrl: _rpcUrl,
    );
    final payload = _payload(draft);
    return const SolanaLocalSigner().signSystemTransfer(
      mnemonic: mnemonic,
      expectedFromAddress: draft.fromAddress,
      toAddress: draft.toAddress,
      lamports: payload.lamports,
      recentBlockhash: payload.blockhash,
    );
  }

  @override
  Future<TransactionSubmissionResult> broadcast({
    required TransactionDraft draft,
    required String signedPayload,
  }) async {
    if (!SolanaTestnetBroadcast.enabledNow) {
      final hash = WalletCrypto.shortHash(
        '${draft.unsignedPayload}:$signedPayload:${DateTime.now().microsecondsSinceEpoch}',
      );
      return TransactionSubmissionResult(
        id: '${chain.key}-${DateTime.now().millisecondsSinceEpoch}',
        hash: hash,
        status: TxStatus.pending,
        explorerUrl: '$explorerBaseUrl$hash',
        submittedAt: DateTime.now(),
        preview: true,
      );
    }
    SolanaTestnetBroadcast.assertAllowed(
      canBroadcastTestnet: ReleaseConfig.canBroadcastTestnet,
      liveBroadcastEnabled: ReleaseConfig.liveBroadcastEnabled,
      isTestnetEnv: AuvoraNetworkEnv.isTestnet,
      rpcUrl: _rpcUrl,
    );
    if (signedPayload.trim().isEmpty) {
      throw const SolanaRpcException('Missing locally signed payload.');
    }
    final signature = await _rpc.sendTransaction(_rpcUrl, signedPayload);
    final suffix = AuvoraQaLocalSolana.isActive ? '' : '?cluster=devnet';
    return TransactionSubmissionResult(
      id: '${chain.key}-$signature',
      hash: signature,
      status: TxStatus.pending,
      explorerUrl: '$explorerBaseUrl$signature$suffix',
      submittedAt: DateTime.now(),
      preview: false,
    );
  }

  @override
  Future<EndpointHealth> ping() async {
    final started = Stopwatch()..start();
    try {
      final healthy = await _rpc.getHealth(_rpcUrl);
      started.stop();
      return EndpointHealth(
        chain: chain,
        endpoint: RpcEndpoints.displayLabel(_rpcUrl),
        latencyMs: started.elapsedMilliseconds,
        state: healthy ? EndpointState.healthy : EndpointState.degraded,
        lastCheckedAt: DateTime.now(),
        failoverCount: healthy ? 0 : 1,
      );
    } catch (_) {
      return EndpointHealth(
        chain: chain,
        endpoint: providerCode,
        latencyMs: 0,
        state: EndpointState.degraded,
        lastCheckedAt: DateTime.now(),
        failoverCount: 1,
      );
    }
  }

  String get _rpcUrl {
    final urls = RpcEndpoints.urlsFor(chain);
    if (urls.isEmpty)
      throw const SolanaRpcException('No Solana RPC endpoint configured.');
    return urls.first;
  }

  static int _solToLamports(double amount) {
    if (!amount.isFinite || amount <= 0) {
      throw ArgumentError.value(amount, 'amount');
    }
    return (amount * 1000000000).round();
  }

  static ({int lamports, String blockhash}) _payload(TransactionDraft draft) {
    final decoded = jsonDecode(draft.unsignedPayload);
    if (decoded is! Map)
      throw const SolanaRpcException('Invalid unsigned Solana payload.');
    final from = decoded['from'];
    final to = decoded['to'];
    final lamports = decoded['lamports'];
    final blockhash = decoded['recentBlockhash'];
    if (from != draft.fromAddress ||
        to != draft.toAddress ||
        lamports is! num ||
        blockhash is! String) {
      throw const SolanaRpcException(
          'Unsigned Solana payload does not match draft.');
    }
    return (lamports: lamports.toInt(), blockhash: blockhash);
  }
}
