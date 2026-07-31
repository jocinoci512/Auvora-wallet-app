import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../portfolio/models.dart';
import '../../privacy/clipboard_guard.dart';
import '../../theme/aether_theme.dart';

String greetingFor(DateTime now) {
  final h = now.hour;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

String relativeTime(DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'Just now';
  if (d.inMinutes < 60) return '${d.inMinutes}m ago';
  if (d.inHours < 24) return '${d.inHours}h ago';
  if (d.inDays < 7) return '${d.inDays}d ago';
  return '${t.month}/${t.day}/${t.year}';
}

Color statusColor(TxStatus s) {
  switch (s) {
    case TxStatus.pending:
      return const Color(0xFFB54708);
    case TxStatus.completed:
      return const Color(0xFF067647);
    case TxStatus.failed:
      return AetherColors.danger;
    case TxStatus.cancelled:
      return AetherColors.muted;
  }
}

IconData typeIcon(TxType t) {
  switch (t) {
    case TxType.send:
      return Icons.arrow_upward_rounded;
    case TxType.receive:
      return Icons.arrow_downward_rounded;
    case TxType.swap:
      return Icons.swap_horiz_rounded;
    case TxType.buy:
      return Icons.shopping_bag_outlined;
    case TxType.sell:
      return Icons.sell_outlined;
    case TxType.bridge:
      return Icons.hub_outlined;
    case TxType.stake:
    case TxType.unstake:
      return Icons.savings_outlined;
  }
}

Future<void> copyText(BuildContext context, String text, {String label = 'Copied'}) async {
  try {
    await copyTextSecure(context, text, label: label);
  } catch (_) {
    await Clipboard.setData(ClipboardData(text: text));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(label)));
    }
  }
}

void showActionSheet(BuildContext context, {required String title, required String body}) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(ctx).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(body, style: TextStyle(color: AetherColors.mutedFor(ctx), height: 1.45)),
          const SizedBox(height: 16),
          FilledButton(onPressed: () => Navigator.pop(ctx), child: const Text('Got it')),
        ],
      ),
    ),
  );
}

class SoftBanner extends StatelessWidget {
  const SoftBanner({super.key, required this.message, this.actionLabel, this.onAction, this.tone = BannerTone.info});

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final BannerTone tone;

  @override
  Widget build(BuildContext context) {
    final bg = switch (tone) {
      BannerTone.info => AetherColors.lagoon.withValues(alpha: 0.08),
      BannerTone.warn => AetherColors.warn.withValues(alpha: 0.1),
      BannerTone.error => AetherColors.danger.withValues(alpha: 0.1),
    };
    final fg = switch (tone) {
      BannerTone.info => AetherColors.lagoon,
      BannerTone.warn => AetherColors.warn,
      BannerTone.error => AetherColors.danger,
    };
    final icon = switch (tone) {
      BannerTone.info => Icons.info_outline_rounded,
      BannerTone.warn => Icons.warning_amber_rounded,
      BannerTone.error => Icons.error_outline_rounded,
    };
    final roleLabel = switch (tone) {
      BannerTone.info => 'Status',
      BannerTone.warn => 'Warning',
      BannerTone.error => 'Error',
    };
    return Semantics(
      container: true,
      liveRegion: true,
      label: '$roleLabel: $message',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: fg.withValues(alpha: 0.14)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: fg),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: TextStyle(color: fg, height: 1.35, fontSize: 13, fontWeight: FontWeight.w500),
              ),
            ),
            if (actionLabel != null && onAction != null)
              TextButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ),
      ),
    );
  }
}

enum BannerTone { info, warn, error }

class TrendChart extends StatelessWidget {
  const TrendChart({super.key, required this.values, this.height = 72, this.color = AetherColors.lagoon});

  final List<double> values;
  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (values.length < 2) {
      return SizedBox(height: height);
    }
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(painter: _TrendPainter(values: values, color: color)),
    );
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter({required this.values, required this.color});

  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final min = values.reduce((a, b) => a < b ? a : b);
    final max = values.reduce((a, b) => a > b ? a : b);
    final span = (max - min).abs() < 0.0001 ? 1.0 : max - min;
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * (i / (values.length - 1));
      final y = size.height - ((values[i] - min) / span) * size.height * 0.85 - size.height * 0.08;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    final fill = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      fill,
      Paint()..color = color.withValues(alpha: 0.12),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _TrendPainter oldDelegate) =>
      oldDelegate.values != values || oldDelegate.color != color;
}

class AllocationBar extends StatelessWidget {
  const AllocationBar({super.key, required this.assets});

  final List<AssetHolding> assets;

  @override
  Widget build(BuildContext context) {
    final total = assets.fold<double>(0, (s, a) => s + a.fiatValue);
    if (total <= 0) {
      return Container(
        height: 10,
        decoration: BoxDecoration(color: AetherColors.border, borderRadius: BorderRadius.circular(99)),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: SizedBox(
        height: 10,
        child: Row(
          children: [
            for (final a in assets.where((x) => x.fiatValue > 0))
              Expanded(
                flex: (a.fiatValue / total * 1000).round().clamp(1, 1000),
                child: ColoredBox(color: Color(a.color)),
              ),
          ],
        ),
      ),
    );
  }
}

class AssetAvatar extends StatelessWidget {
  const AssetAvatar({super.key, required this.asset, this.size = 40});

  final AssetHolding asset;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Color(asset.color).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      child: Text(
        asset.ticker.isEmpty ? '?' : asset.ticker[0],
        style: TextStyle(
          color: Color(asset.color),
          fontWeight: FontWeight.w700,
          fontSize: size * 0.38,
        ),
      ),
    );
  }
}
