import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../intelligence/catalog.dart';
import '../intelligence/intelligence_controller.dart';
import '../intelligence/models.dart';
import '../portfolio/models.dart';
import '../portfolio/portfolio_controller.dart';
import '../release/release_config.dart';
import '../theme/aether_theme.dart';
import 'home/home_shared.dart';
import 'intelligence/intelligence_tip.dart';
import 'intelligence/learning_center_screen.dart';

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
    final intel = context.watch<IntelligenceController>();
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
    final explanation = intel.transactionExplanation(tx);

    final receipt = [
      'Auvora receipt',
      '${tx.type.label} ${tx.amount} ${tx.assetTicker}',
      'Status: ${tx.status.label}',
      'Network: ${tx.network.label}',
      'Transaction ID: ${tx.hash}',
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
                  style: TextStyle(
                    color: statusColor(tx.status),
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (explanation != null)
            IntelligenceExplainPanel(
              explanation: explanation,
              compact: intel.useCompactExplanation(explanation),
              onLearnMore: explanation.learnTopicId == null
                  ? null
                  : () => openLesson(context, explanation.learnTopicId),
            )
          else
            Text(
              _friendlyFallback(tx),
              style: const TextStyle(color: AetherColors.muted, height: 1.45),
            ),
          if (tx.fee != null &&
              intel.shouldShowExplanation(IntelligenceKind.transaction) &&
              (tx.fee ?? 0) > 0.02) ...[
            const SizedBox(height: 12),
            IntelligenceExplainPanel(
              explanation: IntelligenceCatalog.explainFeeEstimate(
                networkLabel: tx.network.label,
                elevated: true,
              ),
              onLearnMore: () => openLesson(context, 'gas-fees'),
            ),
          ],
          const SizedBox(height: 24),
          _kv('Network', tx.network.label),
          _kv('Date', date),
          _kv('Time', time),
          if (tx.fee != null)
            _kv('Network fee', p.hideBalances ? '••••' : '${tx.fee} ${tx.feeAsset ?? ''}'),
          _kv('From', tx.from),
          _kv('To', tx.to),
          const SizedBox(height: 8),
          const Text('Transaction ID', style: TextStyle(color: AetherColors.muted, fontSize: 13)),
          const SizedBox(height: 4),
          SelectableText(tx.hash, style: const TextStyle(fontSize: 13, height: 1.4)),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => copyText(context, tx.hash, label: 'Transaction ID copied'),
            icon: const Icon(Icons.copy_rounded),
            label: const Text('Copy transaction ID'),
          ),
          const SizedBox(height: 10),
          if (explorer != null) ...[
            OutlinedButton.icon(
              onPressed: ReleaseConfig.liveBroadcastEnabled
                  ? () => _openExplorer(context, explorer)
                  : null,
              icon: const Icon(Icons.open_in_new_rounded),
              label: ReleaseConfig.liveBroadcastEnabled
                  ? const Text('Open in explorer')
                  : const Text('Explorer (unavailable — preview)'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: ReleaseConfig.liveBroadcastEnabled
                  ? () => copyText(context, explorer, label: 'Explorer link copied')
                  : null,
              icon: const Icon(Icons.link_rounded),
              label: ReleaseConfig.liveBroadcastEnabled
                  ? const Text('Copy explorer link')
                  : const Text('Explorer link (preview only)'),
            ),
            const SizedBox(height: 10),
          ],
          if (tx.status == TxStatus.failed || tx.status == TxStatus.cancelled) ...[
            SoftBanner(
              tone: BannerTone.warn,
              message: tx.status == TxStatus.failed
                  ? 'If nothing left your wallet, you can try again from Send. Check network fees and balance first.'
                  : 'This request was cancelled before completion. Start a new send if you still need to transfer.',
            ),
            const SizedBox(height: 10),
          ],
          if (!ReleaseConfig.liveBroadcastEnabled) ...[
            const SoftBanner(
              tone: BannerTone.warn,
              message:
                  'Explorer pages may not show this preview transfer. Live broadcast is off until signing is audited.',
            ),
            const SizedBox(height: 10),
          ],
          FilledButton.icon(
            onPressed: () => copyText(context, receipt, label: 'Receipt copied — paste to share'),
            icon: const Icon(Icons.ios_share_rounded),
            label: const Text('Share receipt'),
          ),
        ],
      ),
    );
  }

  Future<void> _openExplorer(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open explorer. Copy the link instead.')),
      );
    }
  }

  String _friendlyFallback(PortfolioTx tx) {
    switch (tx.status) {
      case TxStatus.pending:
        return 'Still confirming on ${tx.network.label}. This usually finishes in a few minutes — keep this screen or check Activity later.';
      case TxStatus.completed:
        return ReleaseConfig.liveBroadcastEnabled
            ? 'This ${tx.type.label.toLowerCase()} finished successfully on ${tx.network.label}.'
            : 'This ${tx.type.label.toLowerCase()} was recorded as a local preview on ${tx.network.label}. It was not broadcast on-chain.';
      case TxStatus.failed:
        return tx.note ??
            'This transfer did not complete. Amounts beyond any network fee already paid usually stay in your wallet. You can retry from Send.';
      case TxStatus.cancelled:
        return 'You cancelled this request before it finished on the network.';
    }
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
