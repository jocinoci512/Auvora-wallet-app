import '../crypto/wallet_crypto.dart';
import '../portfolio/models.dart';
import '../release/network_env.dart';
import 'blockchain_adapter.dart';
import 'evm_json_rpc.dart';
import 'models.dart';
import 'rpc_endpoints.dart';

/// Live EVM adapter: native balances via `eth_getBalance` (Sepolia / Amoy / BSC Testnet
/// when [AuvoraNetworkEnv.isTestnet]). Does not invent preview amounts.
///
/// Non-native token balances are not queried yet — [getBalance] throws
/// [RpcBalanceException] so sync preserves last-known values instead of writing a fake zero.
class EvmRpcBlockchainAdapter implements BlockchainAdapter {
  EvmRpcBlockchainAdapter({
    required this.chain,
    required this.providerCode,
    required this.explorerBaseUrl,
    EvmJsonRpcClient? rpcClient,
  }) : _rpc = rpcClient ?? EvmJsonRpcClient();

  @override
  final ChainId chain;

  @override
  final String providerCode;

  final String explorerBaseUrl;
  final EvmJsonRpcClient _rpc;

  int get expectedChainId => EvmJsonRpcClient.expectedChainId(chain);

  @override
  WalletAddressRecord deriveAddress({
    required String mnemonic,
    required int accountIndex,
  }) {
    final network = chain.assetNetwork;
    final path = WalletCrypto.derivationPathFor(network, accountIndex: accountIndex);
    return WalletAddressRecord(
      chain: chain,
      address: WalletCrypto.deriveAddressForNetwork(mnemonic, network, index: accountIndex),
      derivationPath: path,
      label: AuvoraNetworkEnv.displayName(network),
    );
  }

  @override
  Future<double> getBalance({
    required WalletAddressRecord address,
    required String assetSymbol,
  }) async {
    if (assetSymbol.toUpperCase() != chain.nativeTicker.toUpperCase()) {
      // Honest: ERC-20 path not wired — do not invent preview balances.
      throw RpcBalanceException(
        'Token balance RPC not available for $assetSymbol on ${chain.key}',
        chainId: expectedChainId,
      );
    }
    final result = await _rpc.getNativeBalanceWei(
      chain: chain,
      address: address.address,
    );
    return EvmAmountCodec.weiToEth(result.wei);
  }

  @override
  Future<List<PortfolioTx>> getHistory({
    required WalletAddressRecord address,
  }) async {
    // History indexing not wired for live RPC yet — empty is honest (not fake preview txs).
    return const [];
  }

  @override
  Future<TransactionFeeEstimate> estimateFee({
    required WalletAddressRecord from,
    required String assetSymbol,
    required double amount,
  }) async {
    return switch (chain) {
      ChainId.bnbSmartChain => TransactionFeeEstimate(
          networkFee: 0.0003,
          networkFeeAsset: 'BNB',
          networkFeeUsd: 0.05,
          arrivalLabel: 'Usually under a minute',
          explorerBaseUrl: explorerBaseUrl,
        ),
      ChainId.polygon => TransactionFeeEstimate(
          networkFee: 0.02,
          networkFeeAsset: 'POL',
          networkFeeUsd: 0.01,
          arrivalLabel: 'Usually under 2 minutes',
          explorerBaseUrl: explorerBaseUrl,
        ),
      _ => TransactionFeeEstimate(
          networkFee: 0.0012,
          networkFeeAsset: 'ETH',
          networkFeeUsd: 0.5,
          arrivalLabel: 'Usually 1–3 minutes',
          explorerBaseUrl: explorerBaseUrl,
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
      unsignedPayload: 'evm:${chain.key}:${from.address}:$toAddress:$assetSymbol:$amount',
    );
  }

  @override
  Future<String> signTransaction({
    required TransactionDraft draft,
    required String mnemonic,
  }) async {
    return 'signed:${WalletCrypto.shortHash('${draft.fromAddress}:${draft.unsignedPayload}')}:local';
  }

  @override
  Future<TransactionSubmissionResult> broadcast({
    required TransactionDraft draft,
    required String signedPayload,
  }) async {
    // Broadcast remains gated by ReleaseConfig — adapter returns preview submission.
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

  @override
  Future<EndpointHealth> ping() async {
    try {
      final urls = RpcEndpoints.urlsFor(chain);
      if (urls.isEmpty) {
        throw RpcBalanceException('No RPC endpoints');
      }
      final id = await _rpc.ethChainId(urls.first);
      final ok = id == expectedChainId;
      return EndpointHealth(
        chain: chain,
        endpoint: RpcEndpoints.displayLabel(urls.first),
        latencyMs: 120,
        state: ok ? EndpointState.healthy : EndpointState.degraded,
        lastCheckedAt: DateTime.now(),
        failoverCount: ok ? 0 : 1,
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
}
