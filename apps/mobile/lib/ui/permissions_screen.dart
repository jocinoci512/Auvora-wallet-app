import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../intelligence/intelligence_controller.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import 'app_shell.dart';

class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> {
  bool _expanded = false;

  Future<void> _requestCamera() async {
    await Permission.camera.request();
    if (mounted) setState(() {});
  }

  Future<void> _requestNotifications() async {
    await Permission.notification.request();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    return ScreenScaffold(
      title: 'You’re almost ready',
      subtitle: 'Optional permissions help later — you can skip and enable them when you need them.',
      reassure: 'We never request access without explaining why.',
      showProgress: true,
      body: ListView(
        children: [
          const Text(
            'Camera is only for scanning address codes when you choose. Notifications are optional activity alerts.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => setState(() => _expanded = !_expanded),
            child: Text(_expanded ? 'Hide details' : 'Review optional permissions'),
          ),
          if (_expanded) ...[
            const SizedBox(height: 8),
            _PermTile(
              icon: Icons.photo_camera_outlined,
              title: 'Camera',
              body: 'Scan QR codes when sending or receiving.',
              actionLabel: 'Allow camera',
              onAction: _requestCamera,
            ),
            const SizedBox(height: 12),
            _PermTile(
              icon: Icons.notifications_none_rounded,
              title: 'Notifications',
              body: 'Optional alerts. You can stay informed from Activity anytime.',
              actionLabel: 'Allow notifications',
              onAction: _requestNotifications,
            ),
          ],
        ],
      ),
      footer: FilledButton(
        onPressed: () async {
          await c.finishPermissions();
          if (!context.mounted) return;
          // After create or import — one calm tip to practice recovery when ready.
          context.read<IntelligenceController>().noteEvent('afterImport');
        },
        child: const Text('Enter my wallet'),
      ),
    );
  }
}

class _PermTile extends StatelessWidget {
  const _PermTile({
    required this.icon,
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: AetherColors.lagoon),
                const SizedBox(width: 10),
                Text(title, style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 8),
            Text(body, style: const TextStyle(color: AetherColors.muted, height: 1.4)),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onAction, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}
