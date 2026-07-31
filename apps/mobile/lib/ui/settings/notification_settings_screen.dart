import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../l10n/auvora_locale.dart';
import '../../preferences/models.dart';
import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';
import 'notification_center_screen.dart';
import 'price_alerts_screen.dart';

class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  State<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen> {
  String _permissionLabel = 'Checking…';

  @override
  void initState() {
    super.initState();
    // ignore: discarded_futures
    _refreshPermission();
  }

  Future<void> _refreshPermission() async {
    final status = await Permission.notification.status;
    if (!mounted) return;
    setState(() {
      _permissionLabel = switch (status) {
        PermissionStatus.granted => 'Allowed on this device',
        PermissionStatus.denied => 'Not allowed yet',
        PermissionStatus.permanentlyDenied => 'Blocked — open system settings',
        PermissionStatus.restricted => 'Restricted by the system',
        PermissionStatus.limited => 'Limited',
        PermissionStatus.provisional => 'Provisional',
      };
    });
  }

  Future<void> _requestPermission() async {
    final status = await Permission.notification.request();
    if (!mounted) return;
    if (status.isPermanentlyDenied) {
      await openAppSettings();
    }
    await _refreshPermission();
  }

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();

    return Scaffold(
      appBar: AppBar(
        title: Text(AuvoraStrings.lookup('notifications.title')),
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
            'In-app Notification Center is active today. Push delivery is prepared behind OS permission.',
            style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(AuvoraStrings.lookup('notifications.permission')),
            subtitle: Text('$_permissionLabel\n${AuvoraStrings.lookup('notifications.permission_body')}'),
            isThreeLine: true,
            trailing: TextButton(
              onPressed: _requestPermission,
              child: const Text('Allow'),
            ),
          ),
          const SizedBox(height: 8),
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
