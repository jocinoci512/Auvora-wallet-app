import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../preferences/models.dart';
import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';

class PriceAlertsScreen extends StatelessWidget {
  const PriceAlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Price alerts'),
        actions: [
          TextButton(
            onPressed: () async {
              final n = await prefs.evaluatePriceAlerts();
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    n == 0
                        ? 'No alerts triggered against preview prices'
                        : '$n alert${n == 1 ? '' : 's'} fired (preview prices)',
                  ),
                ),
              );
            },
            child: const Text('Check now'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _create(context),
        icon: const Icon(Icons.add),
        label: const Text('New alert'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          const Text(
            'Create, pause, or delete alerts. Evaluation uses preview prices on this device — not live markets or push.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 16),
          if (prefs.priceAlerts.isEmpty)
            const Text('No alerts yet.', style: TextStyle(color: AetherColors.muted))
          else
            for (final a in prefs.priceAlerts)
              Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(a.title, style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(
                        '${a.assetSymbol} · ${a.kind.name} · ${a.direction.name} ${a.threshold}'
                        '${a.paused ? ' · Paused' : ''}',
                        style: const TextStyle(color: AetherColors.muted, height: 1.35),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        children: [
                          TextButton(
                            onPressed: () => prefs.pausePriceAlert(a.id, paused: !a.paused),
                            child: Text(a.paused ? 'Resume' : 'Pause'),
                          ),
                          TextButton(
                            onPressed: () => prefs.deletePriceAlert(a.id),
                            child: const Text('Delete'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }

  Future<void> _create(BuildContext context) async {
    final prefs = context.read<PreferencesController>();
    var kind = PriceAlertKind.assetTarget;
    var symbol = 'BTC';
    var direction = PriceAlertDirection.above;
    final thresholdCtrl = TextEditingController(text: '70000');

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: StatefulBuilder(
            builder: (ctx, setModal) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('New price alert', style: Theme.of(ctx).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<PriceAlertKind>(
                    initialValue: kind,
                    decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
                    items: [
                      for (final k in PriceAlertKind.values)
                        DropdownMenuItem(value: k, child: Text(k.name)),
                    ],
                    onChanged: (v) => setModal(() => kind = v ?? kind),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: symbol,
                    decoration: const InputDecoration(labelText: 'Asset', border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: 'BTC', child: Text('BTC')),
                      DropdownMenuItem(value: 'ETH', child: Text('ETH')),
                      DropdownMenuItem(value: 'SOL', child: Text('SOL')),
                      DropdownMenuItem(value: 'PORTFOLIO', child: Text('Portfolio')),
                    ],
                    onChanged: (v) => setModal(() => symbol = v ?? symbol),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<PriceAlertDirection>(
                    initialValue: direction,
                    decoration: const InputDecoration(labelText: 'Direction', border: OutlineInputBorder()),
                    items: [
                      for (final d in PriceAlertDirection.values)
                        DropdownMenuItem(value: d, child: Text(d.name)),
                    ],
                    onChanged: (v) => setModal(() => direction = v ?? direction),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: thresholdCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Threshold',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Create'),
                  ),
                ],
              );
            },
          ),
        );
      },
    );

    if (ok == true) {
      final threshold = double.tryParse(thresholdCtrl.text.trim()) ?? 0;
      if (threshold > 0) {
        await prefs.createPriceAlert(
          kind: kind == PriceAlertKind.portfolioThreshold || symbol == 'PORTFOLIO'
              ? PriceAlertKind.portfolioThreshold
              : kind,
          assetSymbol: symbol,
          threshold: threshold,
          direction: direction,
        );
      }
    }
    thresholdCtrl.dispose();
  }
}
