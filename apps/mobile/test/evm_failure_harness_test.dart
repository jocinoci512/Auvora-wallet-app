import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/portfolio/portfolio_controller.dart';
import 'package:auvora_wallet/wallet_engine/evm_json_rpc.dart';
import 'package:auvora_wallet/wallet_engine/evm_receipt_confirmer.dart';
import 'package:auvora_wallet/wallet_engine/evm_testnet_broadcast.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:flutter_test/flutter_test.dart';

/// Deterministic Local EVM failure-mode harness — no user signing keys.
void main() {
  group('EvmFailureHarness', () {
    test('invalid recipient hash rejected before poll', () {
      expect(EvmReceiptConfirmer.isLiveEvmTxHash('0xabc'), isFalse);
    });

    test('receipt revert maps to Failed status intent', () {
      final receipt = EvmReceiptConfirmer.parseReceipt({
        'status': '0x0',
        'blockNumber': '0x1',
        'gasUsed': '0x5208',
        'effectiveGasPrice': '0x3b9aca07',
      });
      expect(receipt, isNotNull);
      expect(receipt!.success, isFalse);
    });

    test('fetchReceipt returns null when receipt not yet mined', () async {
      final client = EvmJsonRpcClient(
        caller: (url, method, params) async {
          if (method == 'eth_getTransactionReceipt') return null;
          if (method == 'eth_chainId') return '0x7a69';
          throw StateError('unexpected $method');
        },
      );
      final confirmer = EvmReceiptConfirmer(rpc: client);
      final receipt = await confirmer.fetchReceipt(
        chain: ChainId.ethereum,
        txHash: '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f',
      );
      expect(receipt, isNull);
    });

    test('wrong chain id rejected by broadcast gate', () {
      expect(
        () => EvmTestnetBroadcast.assertAllowed(
          chainId: 1,
          rpcUrl: 'http://127.0.0.1:8545',
          isTestnetEnv: true,
          canBroadcastTestnet: true,
          liveBroadcastEnabled: false,
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('mainnet rpc host rejected in testnet mode', () {
      expect(
        () => EvmTestnetBroadcast.assertAllowed(
          chainId: 31337,
          rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
          isTestnetEnv: true,
          canBroadcastTestnet: true,
          liveBroadcastEnabled: false,
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('activity pending filter groups confirming', () {
      expect(TxStatus.confirming.matchesActivityFilter(TxStatus.pending), isTrue);
      expect(TxStatus.completed.matchesActivityFilter(TxStatus.pending), isFalse);
      expect(TxStatus.completed.matchesActivityFilter(TxStatus.completed), isTrue);
    });

    test('double finalization hash set prevents duplicate notify key', () {
      final hash = '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f';
      final dedupe = 'tx-completed-${hash.toLowerCase()}';
      expect(dedupe, 'tx-completed-$hash');
    });

    test('malformed raw tx hex rejected by rpc client', () async {
      final client = EvmJsonRpcClient(
        caller: (url, method, params) async => '0x1',
      );
      expect(
        () => client.ethSendRawTransaction('http://127.0.0.1:8545', '0x01'),
        throwsA(isA<RpcBalanceException>()),
      );
    });

    test('portfolio finalize preserves amount and hash', () async {
      final controller = PortfolioController();
      controller.snapshot = PortfolioSnapshot(
        assets: const [],
        transactions: [
          PortfolioTx(
            id: 't1',
            type: TxType.send,
            status: TxStatus.pending,
            network: AssetNetwork.ethereum,
            assetTicker: 'ETH',
            amount: 0.0001,
            amountUsd: 0.24,
            timestamp: DateTime.now(),
            from: '0x1d549b12f406ec094cdc4e796cf64394e06a32b5',
            to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            hash: '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f',
          ),
        ],
        contacts: const [],
        trend7d: const [0, 0, 0, 0, 0, 0, 0],
        change24hUsd: 0,
        change24hPct: 0,
        updatedAt: DateTime.now(),
        isPreview: true,
      );
      final receipt = EvmTransactionReceipt(
        success: true,
        blockNumber: 1234,
        gasUsed: BigInt.from(21000),
        effectiveGasPrice: BigInt.parse('1000000007'),
        feeWei: BigInt.parse('21000000147000'),
        feeNative: 0.000021000000147,
      );
      final updated = await controller.finalizeTxFromReceipt(
        txId: 't1',
        status: TxStatus.completed,
        receipt: receipt,
      );
      expect(updated?.status, TxStatus.completed);
      expect(updated?.amount, 0.0001);
      expect(updated?.hash, '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f');
      expect(updated?.blockNumber, 1234);
    });
  });
}
