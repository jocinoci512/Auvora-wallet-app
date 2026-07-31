import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../beta/beta_feedback.dart';
import '../../release/release_config.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../../wallet_engine/sync_engine.dart';

class BetaFeedbackScreen extends StatefulWidget {
  const BetaFeedbackScreen({super.key});

  @override
  State<BetaFeedbackScreen> createState() => _BetaFeedbackScreenState();
}

class _BetaFeedbackScreenState extends State<BetaFeedbackScreen> {
  final _store = BetaFeedbackStore();
  final _summary = TextEditingController();
  final _details = TextEditingController();
  BetaFeedbackCategory _category = BetaFeedbackCategory.bug;
  String? _journey;
  bool _includeDiagnostics = false;
  bool _submitting = false;
  List<BetaFeedbackReport> _history = const [];

  static const _journeys = <String>[
    'Create wallet',
    'Import wallet',
    'Enable biometrics',
    'Receive',
    'Send',
    'Swap',
    'Bridge',
    'Stake',
    'WalletConnect',
    'Recover / reinstall',
    'Security Center',
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void dispose() {
    _summary.dispose();
    _details.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    final list = await _store.list();
    if (mounted) setState(() => _history = list);
  }

  Future<void> _submit() async {
    final summary = _summary.text.trim();
    if (summary.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add a short summary (at least a few words).')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final wallet = context.read<WalletController>();
      final sync = context.read<SyncEngine>();
      Map<String, Object?>? diagnostics;
      if (_includeDiagnostics) {
        diagnostics = BetaFeedbackStore.buildSafeDiagnostics(
          offline: sync.syncStatus.offline,
          hasPin: wallet.hasPin,
          biometricsEnabled: wallet.biometricsEnabled,
          syncState: sync.syncStatus.state.name,
          coldStartMs: wallet.coldStartMs,
        );
      }
      final report = await _store.submit(
        category: _category,
        summary: summary,
        details: _details.text,
        includeDiagnostics: _includeDiagnostics,
        journey: _journey,
        diagnostics: diagnostics,
      );
      if (!mounted) return;
      _summary.clear();
      _details.clear();
      setState(() {
        _includeDiagnostics = false;
        _journey = null;
      });
      await _reload();
      if (!mounted) return;
      final share = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Report saved on this device'),
          content: const Text(
            'Nothing was uploaded. Share the report with the Auvora team only if you choose to.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Done')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Share')),
          ],
        ),
      );
      if (share == true) {
        await Share.share(report.toSharePayload(), subject: 'Auvora 1.0 Alpha feedback');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alpha feedback')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          Text(
            '${ReleaseConfig.buildLabel} · ${ReleaseConfig.marketingVersion}',
            style: TextStyle(color: AetherColors.mutedFor(context), fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            'Reports stay on this device until you share them. Never include your recovery phrase.',
            style: TextStyle(color: AetherColors.mutedFor(context), height: 1.45),
          ),
          const SizedBox(height: 16),
          Text('Category', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in BetaFeedbackCategory.values)
                ChoiceChip(
                  label: Text(c.label),
                  selected: _category == c,
                  onSelected: (_) => setState(() => _category = c),
                ),
            ],
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _journey,
            decoration: const InputDecoration(
              labelText: 'Journey (optional)',
              border: OutlineInputBorder(),
            ),
            items: [
              for (final j in _journeys) DropdownMenuItem(value: j, child: Text(j)),
            ],
            onChanged: (v) => setState(() => _journey = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _summary,
            decoration: const InputDecoration(
              labelText: 'Summary',
              border: OutlineInputBorder(),
            ),
            textCapitalization: TextCapitalization.sentences,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _details,
            minLines: 4,
            maxLines: 8,
            decoration: const InputDecoration(
              labelText: 'Details',
              hintText: 'What happened? What did you expect?',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Include diagnostics'),
            subtitle: const Text(
              'Optional. Sync state and device flags only — never keys or your phrase.',
            ),
            value: _includeDiagnostics,
            onChanged: (v) => setState(() => _includeDiagnostics = v),
          ),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: Text(_submitting ? 'Saving…' : 'Save report'),
          ),
          const SizedBox(height: 28),
          Text('Saved on this device', style: Theme.of(context).textTheme.titleMedium),
          if (_history.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'No reports yet.',
                style: TextStyle(color: AetherColors.mutedFor(context)),
              ),
            )
          else
            for (final r in _history.take(10))
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(r.summary),
                subtitle: Text('${r.category.label} · ${r.createdAt.toLocal()}'),
                trailing: IconButton(
                  tooltip: 'Copy report',
                  style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: r.toSharePayload()));
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Report copied')),
                      );
                    }
                  },
                  icon: const Icon(Icons.copy_rounded),
                ),
              ),
        ],
      ),
    );
  }
}
