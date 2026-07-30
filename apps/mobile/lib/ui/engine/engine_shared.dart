import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../engine/models.dart';
import '../../theme/aether_theme.dart';
import '../home/home_shared.dart';
import '../widgets/passcode_entry.dart';

String fmtEngineAmount(double n) {
  if (n >= 100) return n.toStringAsFixed(2);
  if (n >= 1) return n.toStringAsFixed(4);
  return n.toStringAsFixed(6);
}

class EngineQuoteCard extends StatelessWidget {
  const EngineQuoteCard({
    super.key,
    required this.quote,
    this.onRefresh,
    this.refreshing = false,
    this.priceMoved = false,
  });

  final AssetQuote quote;
  final VoidCallback? onRefresh;
  final bool refreshing;
  final bool priceMoved;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AetherColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  quote.isExpired ? 'Quote expired' : 'Quote · ${quote.providerLabel}',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: quote.isExpired ? AetherColors.danger : null,
                  ),
                ),
              ),
              _QuoteTimer(quote: quote),
              if (onRefresh != null)
                IconButton(
                  tooltip: 'Refresh quote',
                  onPressed: refreshing ? null : onRefresh,
                  icon: refreshing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh_rounded),
                ),
            ],
          ),
          if (quote.isPreview) ...[
            const SizedBox(height: 8),
            const SoftBanner(
              message: 'Preview quote — numbers are estimates. Nothing settles until live partners connect.',
            ),
          ],
          if (priceMoved) ...[
            const SizedBox(height: 8),
            const SoftBanner(
              tone: BannerTone.warn,
              message: 'Market moved. Review the new amounts carefully before confirming.',
            ),
          ],
          const SizedBox(height: 10),
          _line('You send', '${fmtEngineAmount(quote.fromAmount)} ${quote.fromAsset}'),
          _line('You receive', '${fmtEngineAmount(quote.toAmount)} ${quote.toAsset}'),
          if (quote.op == EngineOp.swap || quote.op == EngineOp.bridge)
            _line('Minimum you’d keep', '${fmtEngineAmount(quote.minReceived)} ${quote.toAsset}'),
          if (quote.op == EngineOp.swap)
            _line('Exchange rate', '1 ${quote.fromAsset} ≈ ${fmtEngineAmount(quote.rate)} ${quote.toAsset}'),
          if (quote.op == EngineOp.swap)
            _line('Price protection', '${(quote.slippageBps / 100).toStringAsFixed(2)}%'),
          if (quote.apyPct != null) _line('Estimated yearly reward', '${quote.apyPct!.toStringAsFixed(1)}%'),
          if (quote.validatorName != null) _line('Validator', quote.validatorName!),
          if (quote.lockDays != null)
            _line('Time to unlock', quote.lockDays == 0 ? 'Flexible' : 'About ${quote.lockDays} day(s)'),
          if (quote.destNetwork != null)
            _line('Networks', '${quote.sourceNetwork.label} → ${quote.destNetwork!.label}'),
          _line('Estimated arrival', quote.arrivalLabel),
          const Divider(height: 20),
          Text('Fees (before you pay)', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 6),
          for (final f in quote.fees)
            _line(
              f.label,
              f.asset == '%'
                  ? '${f.amount.toStringAsFixed(1)}% of rewards'
                  : f.asset == 'USD'
                      ? '\$${f.amount.toStringAsFixed(2)}'
                      : '${fmtEngineAmount(f.amount)} ${f.asset}',
            ),
          _line('Total fees (estimated)', '\$${quote.totalFeesUsd.toStringAsFixed(2)}'),
          if (quote.routeSummary != null) ...[
            const SizedBox(height: 8),
            Text(quote.routeSummary!, style: const TextStyle(color: AetherColors.muted, fontSize: 12)),
          ],
        ],
      ),
    );
  }

  Widget _line(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(k, style: const TextStyle(color: AetherColors.muted))),
          Flexible(child: Text(v, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

class _QuoteTimer extends StatefulWidget {
  const _QuoteTimer({required this.quote});
  final AssetQuote quote;

  @override
  State<_QuoteTimer> createState() => _QuoteTimerState();
}

class _QuoteTimerState extends State<_QuoteTimer> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.quote.secondsRemaining;
    return Semantics(
      label: s == 0 ? 'Quote expired' : 'Quote expires in $s seconds',
      child: Text(
        s == 0 ? 'Expired' : '${s}s',
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: s <= 5 ? AetherColors.danger : AetherColors.lagoon,
        ),
      ),
    );
  }
}

class EngineStatusTrack extends StatelessWidget {
  const EngineStatusTrack({super.key, required this.status, this.isPreview = true});

  final EngineStatus status;
  final bool isPreview;

  static const _progress = [
    EngineStatus.preparing,
    EngineStatus.waitingConfirmation,
    EngineStatus.processing,
    EngineStatus.completed,
  ];

  @override
  Widget build(BuildContext context) {
    final failed = status == EngineStatus.failed || status == EngineStatus.cancelled;
    final idx = failed ? _progress.length - 1 : _progress.indexOf(status).clamp(0, _progress.length - 1);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          failed ? status.label : status.label,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: failed ? AetherColors.danger : null,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          isPreview
              ? 'Preview progress — no real payment or chain broadcast yet.'
              : 'Stay on this screen. We’ll update each step as it happens.',
          style: const TextStyle(color: AetherColors.muted, height: 1.4),
        ),
        const SizedBox(height: 16),
        for (var i = 0; i < _progress.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Icon(
                  failed && i == _progress.length - 1
                      ? Icons.error_outline_rounded
                      : i < idx
                          ? Icons.check_circle_rounded
                          : i == idx && !failed
                              ? Icons.radio_button_checked_rounded
                              : Icons.radio_button_unchecked_rounded,
                  color: failed && i == _progress.length - 1
                      ? AetherColors.danger
                      : i <= idx && !failed
                          ? AetherColors.lagoon
                          : AetherColors.muted,
                  size: 22,
                ),
                const SizedBox(width: 10),
                Text(
                  _progress[i].label,
                  style: TextStyle(
                    fontWeight: i == idx && !failed ? FontWeight.w700 : FontWeight.w500,
                    color: i <= idx && !failed ? null : AetherColors.muted,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class EngineReceiptView extends StatelessWidget {
  const EngineReceiptView({super.key, required this.receipt, this.onDone});

  final EngineReceipt receipt;
  final VoidCallback? onDone;

  @override
  Widget build(BuildContext context) {
    final ok = receipt.status == EngineStatus.completed;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      children: [
        Icon(
          ok ? Icons.check_circle_outline_rounded : Icons.error_outline_rounded,
          size: 48,
          color: ok ? const Color(0xFF067647) : AetherColors.danger,
        ),
        const SizedBox(height: 12),
        Text(
          ok
              ? (receipt.isPreview
                  ? 'Preview ${receipt.op.label.toLowerCase()} complete'
                  : 'Your ${receipt.op.label.toLowerCase()} is complete')
              : 'Your ${receipt.op.label.toLowerCase()} didn’t finish',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        Text(
          receipt.note ?? 'You can review this anytime in Activity.',
          style: const TextStyle(color: AetherColors.muted, height: 1.45),
        ),
        if (receipt.isPreview) ...[
          const SizedBox(height: 12),
          const SoftBanner(
            tone: BannerTone.warn,
            message: 'No funds moved. Explorer links appear when live rails are connected.',
          ),
        ],
        const SizedBox(height: 18),
        _kv('Type', receipt.op.label),
        _kv('Status', receipt.isPreview && ok ? 'Preview · completed' : receipt.status.label),
        _kv('From', '${fmtEngineAmount(receipt.fromAmount)} ${receipt.fromAsset}'),
        _kv('To', '${fmtEngineAmount(receipt.toAmount)} ${receipt.toAsset}'),
        _kv('Network', receipt.networkLabel),
        _kv('Fees', '\$${receipt.fees.fold<double>(0, (s, f) => s + f.fiatUsd).toStringAsFixed(2)} est.'),
        _kv('Date', receipt.createdAt.toLocal().toString().split('.').first),
        _kv('Source', receipt.providerLabel),
        const Text('Reference', style: TextStyle(color: AetherColors.muted)),
        const SizedBox(height: 4),
        SelectableText(receipt.reference, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () => copyText(context, receipt.reference, label: 'Reference copied'),
          icon: const Icon(Icons.copy_rounded),
          label: const Text('Copy reference'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => Share.share(
            [
              'Auvora ${receipt.op.label}${receipt.isPreview ? ' (preview)' : ''}',
              '${fmtEngineAmount(receipt.fromAmount)} ${receipt.fromAsset} → ${fmtEngineAmount(receipt.toAmount)} ${receipt.toAsset}',
              'Ref: ${receipt.reference}',
              if (receipt.isPreview) 'No funds moved — preview only.',
            ].join('\n'),
            subject: 'Auvora ${receipt.op.label}',
          ),
          icon: const Icon(Icons.ios_share_rounded),
          label: const Text('Share summary'),
        ),
        if (!receipt.isPreview) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () {
              final url = 'https://etherscan.io/tx/${receipt.reference}';
              copyText(context, url, label: 'Explorer link copied');
            },
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('Copy explorer link'),
          ),
        ],
        const SizedBox(height: 8),
        FilledButton(onPressed: onDone ?? () => Navigator.pop(context), child: const Text('Done')),
      ],
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(width: 96, child: Text(k, style: const TextStyle(color: AetherColors.muted))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

Future<bool> engineAuthenticate(
  BuildContext context, {
  required bool hasPin,
  required bool biometricsEnabled,
  required Future<bool> Function(String reason) biometric,
  required Future<bool> Function(String pin) verifyPin,
  required String reason,
}) async {
  if (biometricsEnabled) {
    final ok = await biometric(reason);
    if (ok) return true;
  }
  if (!hasPin) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Set a passcode in Security before authorizing transfers.')),
      );
    }
    return false;
  }
  if (!context.mounted) return false;

  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) {
      String? err;
      return StatefulBuilder(
        builder: (ctx, setLocal) {
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, 24 + MediaQuery.viewInsetsOf(ctx).bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Authorize', style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  reason,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AetherColors.muted, height: 1.4),
                ),
                const SizedBox(height: 12),
                PasscodeEntry(
                  errorText: err,
                  onCompleted: (pin) async {
                    final ok = await verifyPin(pin);
                    if (!ok) {
                      setLocal(() => err = 'Incorrect passcode. Try again.');
                      return;
                    }
                    HapticFeedback.mediumImpact();
                    if (ctx.mounted) Navigator.pop(ctx, true);
                  },
                ),
              ],
            ),
          );
        },
      );
    },
  );
  return result == true;
}
