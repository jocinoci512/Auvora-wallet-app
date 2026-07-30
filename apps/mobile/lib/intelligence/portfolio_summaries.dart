import '../portfolio/models.dart';
import 'models.dart';

/// Portfolio language that observes — never advises.
class PortfolioIntelligence {
  PortfolioIntelligence._();

  static List<PortfolioSummaryLine> summarize(
    PortfolioSnapshot? snap, {
    int maxLines = 1,
  }) {
    if (snap == null || snap.assets.isEmpty) {
      return const [];
    }

    final lines = <PortfolioSummaryLine>[];
    final assets = [...snap.assets]..sort((a, b) => b.fiatValue.compareTo(a.fiatValue));
    final byChange = [...snap.assets]..sort((a, b) => b.change24hPct.compareTo(a.change24hPct));
    final best = byChange.first;
    final worst = byChange.last;
    final absChange = snap.change24hPct.abs();

    if (absChange < 0.35) {
      lines.add(
        const PortfolioSummaryLine(
          id: 'quiet-day',
          text: 'Your portfolio changed little today.',
        ),
      );
    } else if (best.fiatValue > 0) {
      final dir = best.change24hPct >= 0 ? 'up' : 'down';
      lines.add(
        PortfolioSummaryLine(
          id: 'growth-driver',
          text:
              'Most of today’s move came from ${best.ticker} ($dir ${best.change24hPct.abs().toStringAsFixed(1)}%).',
        ),
      );
    }

    final recent = [...snap.transactions]..sort((a, b) => b.timestamp.compareTo(a.timestamp));
    if (recent.isNotEmpty) {
      final counts = <String, int>{};
      for (final tx in recent.take(5)) {
        counts[tx.assetTicker] = (counts[tx.assetTicker] ?? 0) + 1;
      }
      final dominant = counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
      if (dominant.isNotEmpty && dominant.first.value >= 2) {
        lines.add(
          PortfolioSummaryLine(
            id: 'activity-mix',
            text: 'Most recent activity was ${dominant.first.key} transfers.',
          ),
        );
      }
    }

    if (worst.change24hPct < -0.5 && worst.id != best.id) {
      lines.add(
        PortfolioSummaryLine(
          id: 'down-mover',
          text: '${worst.ticker} moved lower today (${worst.change24hPct.toStringAsFixed(1)}%).',
        ),
      );
    }

    final top = assets.first;
    final total = snap.totalUsd;
    if (total > 0 && top.fiatValue / total >= 0.45) {
      lines.add(
        PortfolioSummaryLine(
          id: 'concentration',
          text: '${top.ticker} is a large share of this portfolio — that can be intentional.',
        ),
      );
    }

    return lines.take(maxLines).toList();
  }
}
