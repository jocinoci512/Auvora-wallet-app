import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../preferences/models.dart';
import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';
import 'notification_center_screen.dart';
import 'price_alerts_screen.dart';

class NotificationSettingsScreen extends StatelessWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const NotificationCenterScreen()),
            ),
            child: const Text('Inbox'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Every toggle has a purpose. Turn off anything that does not help you act.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 8),
          const Text(
            'Preview inbox only — no device push in this release.',
            style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const PriceAlertsScreen()),
            ),
            child: const Text('Manage price alerts'),
          ),
          const SizedBox(height: 16),
          for (final info in kNotificationCatalog)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(info.title),
              subtitle: Text(info.purpose, style: const TextStyle(height: 1.35)),
              value: prefs.isNotificationEnabled(info.id),
              onChanged: (v) => prefs.setNotificationEnabled(info.id, v),
            ),
        ],
      ),
    );
  }
}
