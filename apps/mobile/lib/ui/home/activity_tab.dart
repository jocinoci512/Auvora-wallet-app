import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../portfolio/models.dart';
import '../../portfolio/portfolio_controller.dart';
import '../../theme/aether_theme.dart';
import '../transaction_detail_screen.dart';
import 'home_shared.dart';

class ActivityTab extends StatelessWidget {
  const ActivityTab({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PortfolioController>();
    final txs = p.snapshot?.transactions ?? const <PortfolioTx>[];

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Activity', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 4),
                const Text('Every move with clear status and network.', style: TextStyle(color: AetherColors.muted)),
              ],
            ),
          ),
        ),
        if (txs.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('No transactions yet', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  const Text(
                    'Receive or buy crypto to start your history. Pending, completed, failed, and cancelled states will appear here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AetherColors.muted, height: 1.45),
                  ),
                ],
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
            sliver: SliverList.separated(
              itemCount: txs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final tx = txs[i];
                final inbound = tx.type == TxType.receive || tx.type == TxType.buy;
                return Material(
                  color: Theme.of(context).cardTheme.color,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => TransactionDetailScreen(txId: tx.id)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: statusColor(tx.status).withValues(alpha: 0.12),
                            child: Icon(typeIcon(tx.type), color: statusColor(tx.status)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(tx.type.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                                const SizedBox(height: 2),
                                Text(
                                  '${tx.status.label} · ${tx.network.label}',
                                  style: TextStyle(color: statusColor(tx.status), fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                                Text(
                                  relativeTime(tx.timestamp),
                                  style: const TextStyle(color: AetherColors.muted, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                p.hideBalances
                                    ? '••••'
                                    : '${inbound ? '+' : '−'}${tx.amount} ${tx.assetTicker}',
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                              Text(p.money(tx.amountUsd), style: const TextStyle(color: AetherColors.muted, fontSize: 12)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
