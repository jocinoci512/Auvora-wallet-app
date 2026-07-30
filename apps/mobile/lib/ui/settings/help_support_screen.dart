import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/aether_theme.dart';
import '../beta/beta_feedback_screen.dart';
import '../home/home_shared.dart';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  String _query = '';

  static const _faqs = <(String, String)>[
    (
      'How do I hide my balances?',
      'Open Settings → Privacy and turn on Hide balances. You can also tap the eye icon on Home.'
    ),
    (
      'Where is Security Center?',
      'Settings → Security, or More → Security Center. Recovery, devices, and emergency lock live there.'
    ),
    (
      'Why don’t I get push notifications?',
      'This release uses an in-app Notification Center only. Push (FCM/APNs) is planned for a later sprint.'
    ),
    (
      'Can I add another wallet?',
      'Not yet. Account shows a preview list for switch/archive labels. A full multi-wallet vault comes later.'
    ),
    (
      'Are price alerts live?',
      'Alerts are stored on device and check against preview prices when you tap Check now — not live markets.'
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    final faqs = q.isEmpty
        ? _faqs
        : _faqs.where((f) => f.$1.toLowerCase().contains(q) || f.$2.toLowerCase().contains(q)).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Short answers first. Guides and contact options stay one tap away — not a wall of docs.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search help',
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: 16),
          Text('FAQ', style: Theme.of(context).textTheme.titleMedium),
          for (final f in faqs)
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text(f.$1),
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(f.$2, style: const TextStyle(height: 1.45)),
                  ),
                ),
              ],
            ),
          if (faqs.isEmpty) const Text('No FAQ matches.', style: TextStyle(color: AetherColors.muted)),
          const SizedBox(height: 16),
          Text('Guides', style: Theme.of(context).textTheme.titleMedium),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Getting started'),
            subtitle: const Text('Backup, PIN, and first send'),
            onTap: () => showActionSheet(
              context,
              title: 'Getting started',
              body: '1) Confirm your recovery phrase in Security Center.\n2) Set a PIN.\n3) Try a small send on a network you trust.',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Security guide'),
            subtitle: const Text('Phishing, approvals, and safe habits'),
            onTap: () => showActionSheet(
              context,
              title: 'Security guide',
              body: 'Never share your recovery phrase. Review every connection and signature. Prefer catalog-known origins, and reject lookalikes.',
            ),
          ),
          const SizedBox(height: 8),
          Text('Contact', style: Theme.of(context).textTheme.titleMedium),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Send Closed Beta feedback'),
            subtitle: const Text('Bug, confusing UX, performance, security, accessibility'),
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const BetaFeedbackScreen()),
              );
            },
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Contact support'),
            onTap: () => showActionSheet(
              context,
              title: 'Contact support',
              body:
                  'Use Beta feedback in-app for Closed Beta. Never include seed phrases in any channel.',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Report a bug'),
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const BetaFeedbackScreen()),
              );
            },
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Feature request'),
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const BetaFeedbackScreen()),
              );
            },
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Export diagnostics'),
            subtitle: const Text('Requires your approval — no private keys'),
            onTap: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Export diagnostics?'),
                  content: const Text(
                    'Copies a short device summary (app label, platform, theme preference flags). Never includes keys or seed phrases.',
                  ),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                    FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Export')),
                  ],
                ),
              );
              if (ok == true && context.mounted) {
                final payload =
                    'Auvora diagnostics\nplatform: ${Theme.of(context).platform.name}\nexported: ${DateTime.now().toIso8601String()}';
                await Clipboard.setData(ClipboardData(text: payload));
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Diagnostics copied')),
                  );
                }
              }
            },
          ),
        ],
      ),
    );
  }
}
