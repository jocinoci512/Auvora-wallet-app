import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../portfolio/models.dart';
import '../../portfolio/portfolio_controller.dart';
import '../../release/release_config.dart';
import '../../theme/aether_theme.dart';
import '../transaction_detail_screen.dart';
import 'home_shared.dart';

class ActivityTab extends StatelessWidget {
  const ActivityTab({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PortfolioController>();
    final txs = p.filteredTransactions;
    final hasFilters = p.activityQuery.isNotEmpty ||
        p.activityStatusFilter != null ||
        p.activityTypeFilter != null ||
        p.activityNetworkFilter != null;

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
                const Text(
                  'Search, filter, and open any transfer for status and explorer details.',
                  style: TextStyle(color: AetherColors.muted),
                ),
                const SizedBox(height: 14),
                TextField(
                  onChanged: p.setActivityQuery,
                  decoration: InputDecoration(
                    hintText: 'Search hash, asset, address…',
                    prefixIcon: const Icon(Icons.search_rounded),
                    suffixIcon: hasFilters
                        ? IconButton(
                            tooltip: 'Clear filters',
                            onPressed: p.clearActivityFilters,
                            icon: const Icon(Icons.close_rounded),
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      FilterChip(
                        label: const Text('All'),
                        selected: p.activityStatusFilter == null,
                        onSelected: (_) => p.setActivityStatusFilter(null),
                      ),
                      const SizedBox(width: 8),
                      for (final status in [TxStatus.pending, TxStatus.completed, TxStatus.failed, TxStatus.cancelled]) ...[
                        FilterChip(
                          label: Text(status.label),
                          selected: p.activityStatusFilter == status,
                          onSelected: (selected) =>
                              p.setActivityStatusFilter(selected ? status : null),
                        ),
                        const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final type in [
                        TxType.send,
                        TxType.receive,
                        TxType.swap,
                        TxType.buy,
                        TxType.sell,
                        TxType.bridge,
                        TxType.stake,
                      ]) ...[
                        FilterChip(
                          label: Text(type.label),
                          selected: p.activityTypeFilter == type,
                          onSelected: (selected) => p.setActivityTypeFilter(selected ? type : null),
                        ),
                        const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ),
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
                  Text(
                    hasFilters ? 'No matching activity' : 'No transactions yet',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    hasFilters
                        ? 'Try a different search or clear filters to see your full history.'
                        : ReleaseConfig.allowFundingAddresses
                            ? 'Receive or buy crypto to start your history. Pending, completed, failed, and cancelled states will appear here.'
                            : 'Preview sends, swaps, and buys appear here. Real funding receive stays locked in Version 1.0 Alpha — history shows on-device activity only.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AetherColors.muted, height: 1.45),
                  ),
                  if (hasFilters) ...[
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: p.clearActivityFilters,
                      child: const Text('Clear filters'),
                    ),
                  ],
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
                                  style: TextStyle(
                                    color: statusColor(tx.status),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
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
                                    : '${inbound ? '+' : '−'}${p.crypto(tx.amount, tx.assetTicker)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: inbound ? const Color(0xFF067647) : null,
                                ),
                              ),
                              Text(
                                p.money(tx.amountUsd),
                                style: const TextStyle(color: AetherColors.muted, fontSize: 12),
                              ),
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
