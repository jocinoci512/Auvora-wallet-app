import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../l10n/auvora_locale.dart';
import '../../preferences/models.dart';
import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';

enum _InboxGroup { all, unread, transactions, security, priceAlerts, walletConnections, network, system }

extension on _InboxGroup {
  String get label => switch (this) {
        _InboxGroup.all => 'All',
        _InboxGroup.unread => 'Unread',
        _InboxGroup.transactions => 'Transactions',
        _InboxGroup.security => 'Security',
        _InboxGroup.priceAlerts => 'Price alerts',
        _InboxGroup.walletConnections => 'Wallet connections',
        _InboxGroup.network => 'Network',
        _InboxGroup.system => 'System',
      };

  bool matches(AppNotificationItem n) {
    return switch (this) {
      _InboxGroup.all => true,
      _InboxGroup.unread => !n.read,
      _InboxGroup.transactions => const {
          NotificationCategory.incomingTransactions,
          NotificationCategory.outgoingTransactions,
          NotificationCategory.pendingConfirmations,
          NotificationCategory.transactionConfirmations,
          NotificationCategory.failedTransactions,
        }.contains(n.category),
      _InboxGroup.security => n.category == NotificationCategory.securityAlerts,
      _InboxGroup.priceAlerts =>
        n.category == NotificationCategory.priceAlerts || n.category == NotificationCategory.largeBalanceChanges,
      _InboxGroup.walletConnections => n.category == NotificationCategory.walletConnections,
      _InboxGroup.network => n.category == NotificationCategory.networkOutages,
      _InboxGroup.system => n.category == NotificationCategory.softwareUpdates,
    };
  }

  IconData get icon => switch (this) {
        _InboxGroup.all => Icons.inbox_outlined,
        _InboxGroup.unread => Icons.mark_email_unread_outlined,
        _InboxGroup.transactions => Icons.swap_horiz_rounded,
        _InboxGroup.security => Icons.shield_outlined,
        _InboxGroup.priceAlerts => Icons.notifications_active_outlined,
        _InboxGroup.walletConnections => Icons.link_rounded,
        _InboxGroup.network => Icons.wifi_tethering_rounded,
        _InboxGroup.system => Icons.system_update_alt_rounded,
      };
}

class NotificationCenterScreen extends StatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  State<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> {
  _InboxGroup _group = _InboxGroup.all;
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final locale = AuvoraLocale(prefs.locale);
    final items = prefs.inbox.where((n) {
      if (!_group.matches(n)) return false;
      if (_query.trim().isEmpty) return true;
      final q = _query.toLowerCase();
      return n.title.toLowerCase().contains(q) || n.body.toLowerCase().contains(q);
    }).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return Scaffold(
      appBar: AppBar(
        title: Text(AuvoraStrings.lookup('notifications.title', languageCode: prefs.locale.languageCode)),
        actions: [
          TextButton(
            onPressed: prefs.unreadCount == 0 ? null : () => prefs.markAllRead(),
            child: Text(AuvoraStrings.lookup('notifications.mark_all_read', languageCode: prefs.locale.languageCode)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Text(
            AuvoraStrings.lookup('notifications.subtitle', languageCode: prefs.locale.languageCode),
            style: const TextStyle(color: AetherColors.muted, height: 1.4),
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: AuvoraStrings.lookup('notifications.search', languageCode: prefs.locale.languageCode),
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<_InboxGroup>(
            initialValue: _group,
            decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Filter'),
            items: [
              for (final g in _InboxGroup.values)
                DropdownMenuItem(value: g, child: Text(g.label)),
            ],
            onChanged: (v) {
              if (v != null) setState(() => _group = v);
            },
          ),
          const SizedBox(height: 16),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 48),
              child: Column(
                children: [
                  Icon(_group.icon, size: 40, color: AetherColors.muted),
                  const SizedBox(height: 12),
                  Text(
                    AuvoraStrings.lookup('notifications.empty', languageCode: prefs.locale.languageCode),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AetherColors.muted, height: 1.4),
                  ),
                ],
              ),
            )
          else
            for (final n in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Material(
                  color: Theme.of(context).cardTheme.color,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => prefs.markRead(n.id),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            _iconFor(n.category),
                            color: n.read ? AetherColors.muted : AetherColors.lagoon,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        n.title,
                                        style: TextStyle(
                                          fontWeight: n.read ? FontWeight.w500 : FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                    if (!n.read)
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: const BoxDecoration(
                                          color: AetherColors.lagoon,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(n.body, style: const TextStyle(height: 1.35, color: AetherColors.muted)),
                                const SizedBox(height: 6),
                                Text(
                                  locale.formatDateTime(n.createdAt),
                                  style: const TextStyle(fontSize: 12, color: AetherColors.muted),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }

  IconData _iconFor(NotificationCategory category) {
    return switch (category) {
      NotificationCategory.incomingTransactions ||
      NotificationCategory.outgoingTransactions ||
      NotificationCategory.pendingConfirmations ||
      NotificationCategory.transactionConfirmations ||
      NotificationCategory.failedTransactions =>
        Icons.swap_horiz_rounded,
      NotificationCategory.securityAlerts => Icons.shield_outlined,
      NotificationCategory.priceAlerts || NotificationCategory.largeBalanceChanges =>
        Icons.notifications_active_outlined,
      NotificationCategory.walletConnections => Icons.link_rounded,
      NotificationCategory.networkOutages => Icons.wifi_tethering_rounded,
      NotificationCategory.softwareUpdates => Icons.system_update_alt_rounded,
    };
  }
}
