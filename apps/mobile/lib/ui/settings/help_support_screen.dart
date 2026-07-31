import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../l10n/auvora_locale.dart';
import '../../reliability/cache_store.dart';
import '../../search/fuzzy.dart';
import '../../theme/aether_theme.dart';
import '../../wallet_engine/sync_engine.dart';
import '../beta/beta_feedback_screen.dart';
import '../home/home_shared.dart';
import '../intelligence/learning_center_screen.dart';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  String _query = '';
  bool _cachedOffline = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _warmCache());
  }

  Future<void> _warmCache() async {
    try {
      final sync = context.read<SyncEngine>();
      await sync.warmHelpCache();
      // Persist FAQ titles for offline browse markers (content stays in binary).
      await sync.cacheStore.write(
        ns: CacheStore.nsHelp,
        id: 'faq-titles',
        payload: {
          for (final f in _faqs) f.$1: f.$2,
        },
        ttl: const Duration(days: 14),
      );
      final hit = await sync.cacheStore.read<Map<String, Object?>>(
        ns: CacheStore.nsHelp,
        id: 'faq-bundle',
        decode: (raw) => Map<String, Object?>.from(raw as Map),
      );
      if (!mounted) return;
      setState(() => _cachedOffline = hit != null);
    } catch (_) {
      // Provider may be unavailable in isolated routes — ignore.
    }
  }
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
      'This release uses an in-app Notification Center. You can still grant OS notification permission to prepare for future push. Every alert category can be toggled independently in Settings → Notifications.'
    ),
    (
      'Can I add another wallet?',
      'Yes. Account settings let you create, import, rename, switch, and delete encrypted vaults on this device.'
    ),
    (
      'Are price alerts live?',
      'Alerts are stored on device and check against preview prices when you tap Check now — not live markets.'
    ),
    (
      'What is a recovery phrase?',
      'Your recovery phrase is the master key to your wallet. Anyone with it can move funds. Write it down offline and never share it in chat, email, or with a website.'
    ),
    (
      'What are gas fees?',
      'Network fees pay validators to include your transfer. They vary by network congestion and are separate from any Auvora product fee. Review the fee before you confirm.'
    ),
    (
      'How do I disconnect a dApp?',
      'Open Permission Center (More → Web3 & permissions). You can revoke individual grants or disconnect all apps. You can disconnect an application at any time.'
    ),
    (
      'Can I change the theme?',
      'Settings → Appearance. Choose System, Light, or Dark. Transitions are smooth and respect Reduce motion.'
    ),
    (
      'How do I report an issue?',
      'Use Send Alpha feedback or Report a bug below. Never include your recovery phrase in any report.'
    ),
  ];

  static const _guides = <(String, String, String)>[
    (
      'Wallet basics',
      'Keys, addresses, and first steps',
      '1) Confirm your recovery phrase in Security Center.\n2) Set a PIN.\n3) Try a small send on a network you trust.\n\nYour recovery phrase is the master key to your wallet.',
    ),
    (
      'Recovery phrase guide',
      'Backup, verify, and never share',
      'Write the phrase on paper (or another offline method). Verify it in Security Center. Never type it into a website or share it with support. Auvora will never ask for it in chat.',
    ),
    (
      'Gas fee guide',
      'Why networks charge and how to read estimates',
      'Fees pay the network — not Auvora marketing. Higher congestion usually means higher fees. Always read the fee line on the confirmation screen before approving.',
    ),
    (
      'Security best practices',
      'Phishing, approvals, and safe habits',
      'Never share your recovery phrase. Review every connection and signature. Prefer catalog-known origins, and reject lookalikes. Enable biometrics and keep a verified backup.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final q = _query.trim();
    final faqs = q.isEmpty
        ? _faqs
        : fuzzyRank(q, _faqs, (f) => [f.$1, f.$2]);
    final guides = q.isEmpty
        ? _guides
        : fuzzyRank(q, _guides, (g) => [g.$1, g.$2, g.$3]);

    return Scaffold(
      appBar: AppBar(title: Text(AuvoraStrings.lookup('help.title'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Short answers first. Guides and contact options stay one tap away — not a wall of docs.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          if (_cachedOffline) ...[
            const SizedBox(height: 8),
            const Text(
              'Help content is cached on this device for offline reading.',
              style: TextStyle(color: AetherColors.lagoon, height: 1.35, fontSize: 13),
            ),
          ],
          const SizedBox(height: 12),
          TextField(
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: AuvoraStrings.lookup('help.search_hint'),
              border: const OutlineInputBorder(),
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
          for (final g in guides)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(g.$1),
              subtitle: Text(g.$2),
              onTap: () => showActionSheet(context, title: g.$1, body: g.$3),
            ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Learning Center'),
            subtitle: const Text('Short educational lessons'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const LearningCenterScreen()),
            ),
          ),
          const SizedBox(height: 8),
          Text('Contact', style: Theme.of(context).textTheme.titleMedium),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Send Alpha feedback'),
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
                  'Use Alpha feedback in-app for Version 1.0 Alpha. Never include seed phrases in any channel.',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Report an issue'),
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
