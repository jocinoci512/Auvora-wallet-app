import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../intelligence/catalog.dart';
import '../../intelligence/intelligence_controller.dart';
import '../../intelligence/models.dart';
import '../../theme/aether_theme.dart';

class GuidanceSettingsScreen extends StatelessWidget {
  const GuidanceSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final intel = context.watch<IntelligenceController>();

    return Scaffold(
      appBar: AppBar(title: const Text('Guidance')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Auvora Intelligence explains fees, security prompts, and portfolio changes when it helps. You stay in control.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 16),
          Text('Guidance level', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final level in GuidanceLevel.values)
            RadioListTile<GuidanceLevel>(
              contentPadding: EdgeInsets.zero,
              title: Text(_label(level)),
              subtitle: Text(_subtitle(level), style: const TextStyle(height: 1.35)),
              value: level,
              groupValue: intel.prefs.guidanceLevel,
              onChanged: (v) {
                if (v != null) intel.setGuidanceLevel(v);
              },
            ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Educational hints'),
            subtitle: const Text('Optional tips after import, biometrics, and first transfers'),
            value: intel.prefs.educationalHints,
            onChanged: intel.setEducationalHints,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Allow external AI services'),
            subtitle: const Text(
              'Off by default. When off, guidance stays on this device and never sends wallet data to external AI.',
            ),
            value: intel.prefs.allowExternalAi,
            onChanged: intel.setAllowExternalAi,
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => intel.resetDismissedTips(),
            child: const Text('Reset dismissed tips'),
          ),
          const SizedBox(height: 16),
          const Text(
            IntelligenceCatalog.disclaimer,
            style: TextStyle(color: AetherColors.muted, height: 1.4, fontSize: 13),
          ),
        ],
      ),
    );
  }

  String _label(GuidanceLevel level) => switch (level) {
        GuidanceLevel.minimal => 'Less guidance',
        GuidanceLevel.balanced => 'Balanced (recommended)',
        GuidanceLevel.full => 'More guidance',
      };

  String _subtitle(GuidanceLevel level) => switch (level) {
        GuidanceLevel.minimal => 'Security and failure explanations only.',
        GuidanceLevel.balanced => 'Helpful tips when they reduce confusion — not constant chatter.',
        GuidanceLevel.full => 'More educational hints and Learning Center suggestions.',
      };
}
