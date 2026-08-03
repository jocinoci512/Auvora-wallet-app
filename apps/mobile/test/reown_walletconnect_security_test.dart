import 'package:auvora_wallet/connections/evm_local_signer.dart';
import 'package:auvora_wallet/connections/wc_chain_catalog.dart';
import 'package:auvora_wallet/connections/wc_request_parser.dart';
import 'package:auvora_wallet/connections/wallet_connect_provider.dart';
import 'package:auvora_wallet/release/integration_config.dart';
import 'package:auvora_wallet/release/release_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('WcChainCatalog', () {
    test('advertises only EVM CAIP chains', () {
      expect(WcChainCatalog.supportedEip155Chains, contains('eip155:1'));
      expect(WcChainCatalog.supportedEip155Chains, contains('eip155:56'));
      expect(WcChainCatalog.supportedEip155Chains, contains('eip155:137'));
      expect(WcChainCatalog.isSupportedCaip('bip122:000000000019d668'), isFalse);
      expect(WcChainCatalog.isSupportedCaip('tron:mainnet'), isFalse);
      expect(WcChainCatalog.isSupportedCaip('solana:mainnet'), isFalse);
    });

    test('supports safe methods and rejects eth_sign', () {
      expect(WcChainCatalog.isSupportedMethod('personal_sign'), isTrue);
      expect(WcChainCatalog.isSupportedMethod('eth_signTypedData_v4'), isTrue);
      expect(WcChainCatalog.isSupportedMethod('eth_sendTransaction'), isTrue);
      expect(WcChainCatalog.isSupportedMethod('eth_sign'), isFalse);
      expect(WcChainCatalog.isUnsafeRejectedMethod('eth_sign'), isTrue);
    });
  });

  group('WcRequestParser', () {
    test('parses personal_sign', () {
      final parsed = WcRequestParser.parse(
        method: 'personal_sign',
        chainId: 'eip155:1',
        params: ['0x68656c6c6f', '0x1111111111111111111111111111111111111111'],
      );
      expect(parsed.kind, WcRequestKind.personalSign);
      expect(parsed.canMoveFunds, isFalse);
      expect(parsed.messagePreview, isNotNull);
    });

    test('rejects eth_sign as unsafe', () {
      final parsed = WcRequestParser.parse(
        method: 'eth_sign',
        chainId: 'eip155:1',
        params: ['0xabc', '0xmsg'],
      );
      expect(parsed.kind, WcRequestKind.unsafeRejected);
      expect(parsed.rejectReason, contains('eth_sign'));
    });

    test('parses eth_sendTransaction preview fields', () {
      final parsed = WcRequestParser.parse(
        method: 'eth_sendTransaction',
        chainId: 'eip155:1',
        params: [
          {
            'from': '0x1111111111111111111111111111111111111111',
            'to': '0x2222222222222222222222222222222222222222',
            'value': '0xde0b6b3a7640000',
            'data': '0xa9059cbb',
          },
        ],
      );
      expect(parsed.kind, WcRequestKind.sendTransaction);
      expect(parsed.canMoveFunds, isTrue);
      expect(parsed.txPreview!.hasContractInteraction, isTrue);
      expect(parsed.txPreview!.valueWei, greaterThan(BigInt.zero));
    });

    test('rejects unsupported chain', () {
      final parsed = WcRequestParser.parse(
        method: 'personal_sign',
        chainId: 'bip122:000000000019d668',
        params: ['hello', '0x1'],
      );
      expect(parsed.kind, WcRequestKind.unsupported);
    });
  });

  group('EvmLocalSigner broadcast kill switch', () {
    test('liveBroadcastEnabled remains false', () {
      expect(ReleaseConfig.liveBroadcastEnabled, isFalse);
    });

    test('sendTransactionOrRefuse throws when kill switch off', () {
      const signer = EvmLocalSigner();
      expect(
        () => signer.sendTransactionOrRefuse(tx: {
          'from': '0x1',
          'to': '0x2',
          'value': '0x0',
        }),
        throwsA(isA<WcBroadcastDisabledException>()),
      );
    });
  });

  group('PreviewWalletConnectProvider security', () {
    test('isLiveRelay is false', () {
      final p = PreviewWalletConnectProvider();
      expect(p.isLiveRelay, isFalse);
      expect(p.code, 'walletconnect_preview');
    });

    test('validates wc URI shape', () {
      final p = PreviewWalletConnectProvider();
      expect(p.validateInboundUri('wc:abc@2?relay-protocol=irn&symKey=x').valid, isTrue);
      expect(p.validateInboundUri('wc:').valid, isFalse);
      expect(p.validateInboundUri('not-a-uri').valid, isFalse);
    });

    test('never auto-approves — approve requires explicit call', () async {
      final p = PreviewWalletConnectProvider();
      final proposal = await p.createProposal(
        networks: const ['ETHEREUM'],
        permissions: const [],
      );
      expect(proposal.proposalId, isNotEmpty);
      // Session does not exist until approveSession.
      expect(await p.restoreSession('wc_${proposal.proposalId}'), isNull);
    });
  });

  group('IntegrationConfig WC project id', () {
    test('readiness summary exposes boolean only', () {
      final summary = IntegrationConfig.readinessSummary();
      expect(summary.containsKey('wcProjectId'), isTrue);
      expect(summary['wcProjectId'], isA<bool>());
      // Value of project id must never appear in readiness map.
      expect(summary.values.whereType<String>().any((v) => v.length > 20), isFalse);
    });
  });
}
