import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../portfolio/models.dart';
import '../portfolio/portfolio_controller.dart';
import '../theme/aether_theme.dart';
import 'home/home_shared.dart';

class TransactionDetailScreen extends StatelessWidget {
  const TransactionDetailScreen({super.key, required this.txId});

  final String txId;

  String? _explorerUrl(PortfolioTx tx) {
    switch (tx.network) {
      case AssetNetwork.ethereum:
        return 'https://etherscan.io/tx/${tx.hash}';
      case AssetNetwork.polygon:
        return 'https://polygonscan.com/tx/${tx.hash}';
      case AssetNetwork.bitcoin:
        return 'https://mempool.space/tx/${tx.hash}';
      case AssetNetwork.solana:
        return 'https://solscan.io/tx/${tx.hash}';
      case AssetNetwork.bnbSmartChain:
        return 'https://bscscan.com/tx/${tx.hash}';
      case AssetNetwork.tron:
        return 'https://tronscan.org/#/transaction/${tx.hash}';
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PortfolioController>();
    final tx = p.txById(txId);

    if (tx == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Transaction')),
        body: const Center(child: Text('Transaction not found')),
      );
    }

    final inbound = tx.type == TxType.receive || tx.type == TxType.buy;
    final explorer = _explorerUrl(tx);
    final when = tx.timestamp;
    final date =
        '${when.year}-${when.month.toString().padLeft(2, '0')}-${when.day.toString().padLeft(2, '0')}';
    final time =
        '${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}';

    String friendly() {
      switch (tx.status) {
        case TxStatus.pending:
          return 'Still confirming on ${tx.network.label}. This usually finishes in a few minutes.';
        case TxStatus.completed:
          return 'This ${tx.type.label.toLowerCase()} finished successfully on ${tx.network.label}.';
        case TxStatus.failed:
          return tx.note ??
              'This transaction did not complete. No funds left your wallet beyond any network fee already paid.';
        case TxStatus.cancelled:
          return 'You cancelled this request before it settled on-chain.';
      }
    }

    final receipt = [
      'Auvora receipt',
      '${tx.type.label} ${tx.amount} ${tx.assetTicker}',
      'Status: ${tx.status.label}',
      'Network: ${tx.network.label}',
      'Hash: ${tx.hash}',
      'When: $date $time',
    ].join('\n');

    return Scaffold(
      appBar: AppBar(title: Text(tx.type.label)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: statusColor(tx.status).withValues(alpha: 0.12),
                child: Icon(typeIcon(tx.type), color: statusColor(tx.status), size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.hideBalances
                          ? '•••• ${tx.assetTicker}'
                          : '${inbound ? '+' : '−'}${tx.amount} ${tx.assetTicker}',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    Text(p.money(tx.amountUsd), style: const TextStyle(color: AetherColors.muted)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: statusColor(tx.status).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  tx.status.label,
                  style: TextStyle(color: statusColor(tx.status), fontWeight: FontWeight.w700, fontSize: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(friendly(), style: const TextStyle(color: AetherColors.muted, height: 1.45)),
          const SizedBox(height: 24),
          _kv('Network', tx.network.label),
          _kv('Date', date),
          _kv('Time', time),
          if (tx.fee != null) _kv('Fee', p.hideBalances ? '••••' : '${tx.fee} ${tx.feeAsset ?? ''}'),
          _kv('From', tx.from),
          _kv('To', tx.to),
          const SizedBox(height: 8),
          const Text('Transaction hash', style: TextStyle(color: AetherColors.muted, fontSize: 13)),
          const SizedBox(height: 4),
          SelectableText(tx.hash, style: const TextStyle(fontSize: 13, height: 1.4)),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => copyText(context, tx.hash, label: 'Hash copied'),
            icon: const Icon(Icons.copy_rounded),
            label: const Text('Copy hash'),
          ),
          const SizedBox(height: 10),
          if (explorer != null)
            OutlinedButton.icon(
              onPressed: () => copyText(context, explorer, label: 'Explorer link copied'),
              icon: const Icon(Icons.open_in_new_rounded),
              label: const Text('Copy explorer link'),
            ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: () => copyText(context, receipt, label: 'Receipt copied — paste to share'),
            icon: const Icon(Icons.ios_share_rounded),
            label: const Text('Share receipt'),
          ),
        ],
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 88, child: Text(k, style: const TextStyle(color: AetherColors.muted))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
