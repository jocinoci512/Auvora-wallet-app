import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';

class AccessibilitySettingsScreen extends StatelessWidget {
  const AccessibilitySettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final a = prefs.accessibility;

    return Scaffold(
      appBar: AppBar(title: const Text('Accessibility')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'These preferences work with your OS settings. System text scaling still applies within safe bounds.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 16),
          Text('Text scaling (${a.textScale.toStringAsFixed(2)}×)', style: Theme.of(context).textTheme.titleMedium),
          Slider(
            value: a.textScale.clamp(0.85, 1.35),
            min: 0.85,
            max: 1.35,
            divisions: 10,
            label: a.textScale.toStringAsFixed(2),
            onChanged: (v) => prefs.setAccessibility(a.copyWith(textScale: v)),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Reduce motion'),
            subtitle: const Text('Prefer simpler transitions when animations feel distracting'),
            value: a.reduceMotion,
            onChanged: (v) => prefs.setAccessibility(a.copyWith(reduceMotion: v)),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('High contrast'),
            subtitle: const Text('Stronger borders and emphasis where the theme allows'),
            value: a.highContrast,
            onChanged: (v) => prefs.setAccessibility(a.copyWith(highContrast: v)),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Haptics'),
            subtitle: const Text('Light feedback on key confirmations'),
            value: a.hapticsEnabled,
            onChanged: (v) => prefs.setAccessibility(a.copyWith(hapticsEnabled: v)),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Larger touch targets'),
            subtitle: const Text('Extra padding on primary actions where layouts allow'),
            value: a.largeTouchTargets,
            onChanged: (v) => prefs.setAccessibility(a.copyWith(largeTouchTargets: v)),
          ),
        ],
      ),
    );
  }
}
