import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../preferences/models.dart';
import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';

class NotificationCenterScreen extends StatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  State<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> {
  NotificationCategory? _filter;
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final items = prefs.filteredInbox(category: _filter, query: _query);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification center'),
        actions: [
          TextButton(
            onPressed: prefs.unreadCount == 0 ? null : () => prefs.markAllRead(),
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          const Text(
            'In-app alerts for this device. Not push notifications.',
            style: TextStyle(color: AetherColors.muted, height: 1.4),
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search inbox',
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('All'),
                selected: _filter == null,
                onSelected: (_) => setState(() => _filter = null),
              ),
              for (final info in kNotificationCatalog)
                ChoiceChip(
                  label: Text(info.title),
                  selected: _filter == info.id,
                  onSelected: (_) => setState(() => _filter = info.id),
                ),
            ],
          ),
          const SizedBox(height: 16),
          if (items.isEmpty)
            const Text('No notifications match.', style: TextStyle(color: AetherColors.muted))
          else
            for (final n in items)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  n.read ? Icons.mark_email_read_outlined : Icons.mark_email_unread_outlined,
                  color: AetherColors.lagoon,
                ),
                title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w500 : FontWeight.w700)),
                subtitle: Text('${n.body}\n${n.createdAt.toLocal()}', style: const TextStyle(height: 1.35)),
                isThreeLine: true,
                onTap: () => prefs.markRead(n.id),
              ),
        ],
      ),
    );
  }
}
