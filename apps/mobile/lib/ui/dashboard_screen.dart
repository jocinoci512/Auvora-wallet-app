import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    final address = c.address ?? '—';
    final short =
        address.length > 12 ? '${address.substring(0, 6)}…${address.substring(address.length - 4)}' : address;
    final wide = MediaQuery.sizeOf(context).width >= 700;

    return Scaffold(
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: wide ? 720 : double.infinity),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 12, 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Home', style: Theme.of(context).textTheme.headlineMedium),
                              const SizedBox(height: 4),
                              Text(short, style: const TextStyle(color: AetherColors.muted)),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Copy address',
                          onPressed: () async {
                            await Clipboard.setData(ClipboardData(text: address));
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Address copied')),
                              );
                            }
                          },
                          icon: const Icon(Icons.copy_rounded),
                        ),
                        IconButton(
                          tooltip: 'Lock',
                          onPressed: c.hasPin ? c.lock : null,
                          icon: const Icon(Icons.lock_outline_rounded),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(22),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Total balance', style: TextStyle(color: AetherColors.muted)),
                            const SizedBox(height: 6),
                            Text(
                              '\$0.00',
                              style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 10),
                            const Text(
                              'Your wallet is secured on this device. Balances appear when networks are connected — until then, explore Receive to share your address.',
                              style: TextStyle(color: AetherColors.muted, height: 1.45),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 18)),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverGrid.count(
                    crossAxisCount: wide ? 4 : 4,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.9,
                    children: const [
                      _Action(icon: Icons.arrow_upward_rounded, label: 'Send', ready: false),
                      _Action(icon: Icons.arrow_downward_rounded, label: 'Receive', ready: true),
                      _Action(icon: Icons.swap_horiz_rounded, label: 'Swap', ready: false),
                      _Action(icon: Icons.shopping_bag_outlined, label: 'Buy', ready: false),
                      _Action(icon: Icons.sell_outlined, label: 'Sell', ready: false),
                      _Action(icon: Icons.hub_outlined, label: 'Bridge', ready: false),
                      _Action(icon: Icons.savings_outlined, label: 'Stake', ready: false),
                      _Action(icon: Icons.history_rounded, label: 'Activity', ready: true),
                    ],
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 26, 20, 8),
                    child: Text('Recent activity', style: Theme.of(context).textTheme.titleLarge),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(22),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Nothing here yet', style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 6),
                            const Text(
                              'When you move funds, each transfer will show here in plain language — status, amount, and time.',
                              style: TextStyle(color: AetherColors.muted, height: 1.45),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                    child: OutlinedButton(
                      onPressed: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Remove wallet from this phone?'),
                            content: const Text(
                              'This deletes keys stored on this device only. Your funds stay recoverable with your recovery phrase on a new install.',
                            ),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                              FilledButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                child: const Text('Remove'),
                              ),
                            ],
                          ),
                        );
                        if (ok == true) await c.wipeLocalWallet();
                      },
                      child: const Text('Remove wallet from this device'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, required this.ready});

  final IconData icon;
  final String label;
  final bool ready;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).cardTheme.color,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          showModalBottomSheet<void>(
            context: context,
            showDragHandle: true,
            builder: (ctx) => Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: Theme.of(ctx).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(
                    ready
                        ? 'Your wallet is ready. Network activity for $label will appear here as connections come online — your keys stay on-device either way.'
                        : '$label will open when live networks are connected. Your wallet and recovery phrase are already protected.',
                    style: const TextStyle(color: AetherColors.muted, height: 1.45),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Got it'),
                  ),
                ],
              ),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: AetherColors.lagoon),
              const SizedBox(height: 6),
              Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}
