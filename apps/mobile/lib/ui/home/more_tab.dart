import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../portfolio/portfolio_controller.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../address_book_screen.dart';
import '../security/security_center_screen.dart';
import 'home_shared.dart';

class MoreTab extends StatelessWidget {
  const MoreTab({super.key});

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletController>();
    final p = context.watch<PortfolioController>();
    final address = wallet.address ?? '—';
    final short =
        address.length > 12 ? '${address.substring(0, 6)}…${address.substring(address.length - 4)}' : address;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('More', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 4),
        const Text('Address, privacy, and security.', style: TextStyle(color: AetherColors.muted)),
        const SizedBox(height: 20),
        Text('Wallet', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        SelectableText(address, style: const TextStyle(fontSize: 13, height: 1.4)),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => copyText(context, address, label: 'Address copied'),
          child: Text('Copy $short'),
        ),
        const SizedBox(height: 28),
        Text('Security', style: Theme.of(context).textTheme.titleMedium),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.shield_outlined, color: AetherColors.lagoon),
          title: const Text('Security Center'),
          subtitle: const Text('Review recovery, devices, sessions, connected apps, and privacy'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const SecurityCenterScreen()),
          ),
        ),
        const Padding(
          padding: EdgeInsets.only(bottom: 16),
          child: Text(
            'Privacy controls now live inside Security Center so protection settings stay in one place.',
            style: TextStyle(color: AetherColors.muted, height: 1.4),
          ),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.contacts_outlined, color: AetherColors.lagoon),
          title: const Text('Address book'),
          subtitle: const Text('Trusted recipients'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const AddressBookScreen()),
          ),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.notifications_none_rounded, color: AetherColors.lagoon),
          title: const Text('Notifications'),
          subtitle: const Text('No alerts right now'),
          onTap: () => showActionSheet(
            context,
            title: 'Notifications',
            body: 'You will see confirmations and security notices here when something needs attention.',
          ),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(
            wallet.biometricsEnabled ? Icons.fingerprint : Icons.lock_outline_rounded,
            color: AetherColors.lagoon,
          ),
          title: Text(
            wallet.biometricsEnabled
                ? 'Biometrics on'
                : wallet.hasPin
                    ? 'Passcode on'
                    : 'Add a passcode',
          ),
          subtitle: const Text('This device only'),
          trailing: wallet.hasPin
              ? TextButton(onPressed: wallet.lock, child: const Text('Lock now'))
              : null,
        ),
        const SizedBox(height: 24),
        Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: EdgeInsets.zero,
            title: const Text('Preview data', style: TextStyle(fontSize: 14, color: AetherColors.muted)),
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(p.emptyMode ? 'Load sample portfolio' : 'Show empty portfolio'),
                subtitle: const Text('For design review only — not live balances'),
                onTap: () async {
                  await p.setEmptyMode(!p.emptyMode);
                  await p.refresh(wallet.address);
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
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
                  FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
                ],
              ),
            );
            if (ok == true) await wallet.wipeLocalWallet();
          },
          child: const Text('Remove wallet from this device'),
        ),
      ],
    );
  }
}
