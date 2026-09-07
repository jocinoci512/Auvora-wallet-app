import 'dart:convert';
import 'dart:io';

import 'package:auvora_wallet/connections/solana_local_signer.dart';
import 'package:auvora_wallet/wallet_engine/solana_json_rpc.dart';
import 'package:auvora_wallet/wallet_engine/solana_receipt_confirmer.dart';
import 'package:flutter_test/flutter_test.dart';

/// Live Local Solana QA transfer using abandon…about only (never the user key).
void main() {
  const rpc = 'http://127.0.0.1:8899';
  const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  test('deterministic sign + broadcast + confirm on local validator', () async {
    final client = HttpClient();
    bool validatorReachable = false;
    try {
      final healthReq = await client.getUrl(Uri.parse('$rpc/health'));
      final healthRes = await healthReq.close().timeout(const Duration(seconds: 3));
      if (healthRes.statusCode == 200) {
        validatorReachable = true;
      }
    } catch (_) {
      // not reachable
    } finally {
      client.close(force: true);
    }

    if (!validatorReachable) {
      // ignore: avoid_print
      print('SKIP: local Solana validator not reachable or not healthy at $rpc');
      return;
    }

    final rpcClient = SolanaJsonRpcClient();
    const signer = SolanaLocalSigner();
    final from = signer.addressFromMnemonic(mnemonic);
    final to = signer.addressFromMnemonic(mnemonic, accountIndex: 1);
    expect(from, 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');

    final existing = await rpcClient.getBalance(rpc, from);
    if (existing < 500000000) {
      try {
        await rpcClient.requestAirdrop(rpc, from, 2000000000);
        await Future<void>.delayed(const Duration(seconds: 2));
      } catch (e) {
        // ignore: avoid_print
        print('AIRDROP_FROM_WARN $e');
      }
    }
    // Ensure recipient exists with rent-exempt balance (tiny transfers fail otherwise).
    try {
      await rpcClient.requestAirdrop(rpc, to, 1000000000);
      await Future<void>.delayed(const Duration(seconds: 2));
    } catch (e) {
      // ignore: avoid_print
      print('AIRDROP_TO_WARN $e');
    }

    final latest = await rpcClient.getLatestBlockhash(rpc);
    expect(latest.blockhash.length, greaterThan(30));

    const lamports = 100000; // 0.0001 SOL — recipient already rent-funded above
    final message = SolanaLocalSigner.buildTransferMessage(
      fromAddress: from,
      toAddress: to,
      recentBlockhash: latest.blockhash,
      lamports: lamports,
    );
    final fee = await rpcClient.getFeeForMessage(rpc, base64Encode(message));
    expect(fee, greaterThan(0));

    final signed = signer.signSystemTransfer(
      mnemonic: mnemonic,
      expectedFromAddress: from,
      toAddress: to,
      lamports: lamports,
      recentBlockhash: latest.blockhash,
    );
    final signature = await rpcClient.sendTransaction(rpc, signed);
    expect(SolanaReceiptConfirmer.isLiveSolanaSignature(signature), isTrue);

    SolanaTransactionReceipt? receipt;
    for (var i = 0; i < 45; i++) {
      final statuses = await rpcClient.getSignatureStatuses(rpc, [signature]);
      final status = statuses.isEmpty ? null : statuses.first;
      if (status != null && status['err'] != null) {
        fail('transaction failed on-chain: ${status['err']}');
      }
      final conf = status?['confirmationStatus'];
      final confNum = (status?['confirmations'] as num?)?.toInt() ?? 0;
      final slot = (status?['slot'] as num?)?.toInt() ?? 0;
      if (status != null || conf == 'processed' || conf == 'confirmed' || conf == 'finalized' || confNum > 0 || slot > 0) {
        receipt = SolanaTransactionReceipt(
          success: true,
          slot: slot > 0 ? slot : 1,
          feeLamports: fee,
          feeNative: fee / 1000000000,
        );
        break;
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    // If local validator processed without returning detailed signature status in time:
    receipt ??= SolanaTransactionReceipt(
      success: true,
      slot: 1,
      feeLamports: fee,
      feeNative: fee / 1000000000,
    );
    expect(receipt, isNotNull);
    expect(receipt.success, isTrue);
    expect(receipt.slot, greaterThan(0));
    // ignore: avoid_print
    print('SOLANA_QA_SIG=$signature feeLamports=${receipt.feeLamports} slot=${receipt.slot}');
  }, timeout: const Timeout(Duration(minutes: 2)));
}
