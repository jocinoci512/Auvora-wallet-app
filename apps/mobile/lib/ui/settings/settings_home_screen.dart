import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';
import 'about_screen.dart';
import 'accessibility_settings_screen.dart';
import 'account_settings_screen.dart';
import 'appearance_settings_screen.dart';
import 'diagnostics_screen.dart';
import 'help_support_screen.dart';
import '../intelligence/guidance_settings_screen.dart';
import '../intelligence/learning_center_screen.dart';
import 'networks_settings_screen.dart';
import 'notification_center_screen.dart';
import 'notification_settings_screen.dart';
import 'price_alerts_screen.dart';
import 'privacy_settings_screen.dart';
import 'wallet_preferences_screen.dart';
import '../security/security_center_screen.dart';

class _Category {
  const _Category({
    required this.title,
    required this.description,
    required this.icon,
    required this.builder,
  });

  final String title;
  final String description;
  final IconData icon;
  final WidgetBuilder builder;
}

class SettingsHomeScreen extends StatefulWidget {
  const SettingsHomeScreen({super.key});

  @override
  State<SettingsHomeScreen> createState() => _SettingsHomeScreenState();
}

class _SettingsHomeScreenState extends State<SettingsHomeScreen> {
  bool _bootstrapped = false;
  String _query = '';

  static final _categories = <_Category>[
    _Category(
      title: 'Account',
      description: 'Wallet name, nickname, and preview wallet list',
      icon: Icons.person_outline_rounded,
      builder: (_) => const AccountSettingsScreen(),
    ),
    _Category(
      title: 'Wallet',
      description: 'Currency, sorting, balances, and refresh behavior',
      icon: Icons.account_balance_wallet_outlined,
      builder: (_) => const WalletPreferencesScreen(),
    ),
    _Category(
      title: 'Security',
      description: 'Recovery, devices, sessions, and protection score',
      icon: Icons.shield_outlined,
      builder: (_) => const SecurityCenterScreen(),
    ),
    _Category(
      title: 'Notifications',
      description: 'Choose which alerts matter — silence the rest',
      icon: Icons.notifications_none_rounded,
      builder: (_) => const NotificationSettingsScreen(),
    ),
    _Category(
      title: 'Price alerts',
      description: 'Create, pause, and delete custom targets',
      icon: Icons.trending_up_rounded,
      builder: (_) => const PriceAlertsScreen(),
    ),
    _Category(
      title: 'Appearance',
      description: 'Theme, language formats, and display feel',
      icon: Icons.palette_outlined,
      builder: (_) => const AppearanceSettingsScreen(),
    ),
    _Category(
      title: 'Privacy',
      description: 'Hide balances, analytics, clipboard, and screenshots',
      icon: Icons.visibility_off_outlined,
      builder: (_) => const PrivacySettingsScreen(),
    ),
    _Category(
      title: 'Networks',
      description: 'Default network and preview RPC health',
      icon: Icons.hub_outlined,
      builder: (_) => const NetworksSettingsScreen(),
    ),
    _Category(
      title: 'Accessibility',
      description: 'Text size, motion, contrast, and touch targets',
      icon: Icons.accessibility_new_rounded,
      builder: (_) => const AccessibilitySettingsScreen(),
    ),
    _Category(
      title: 'Guidance',
      description: 'Auvora Intelligence level, tips, and Learning Center',
      icon: Icons.auto_awesome_outlined,
      builder: (_) => const GuidanceSettingsScreen(),
    ),
    _Category(
      title: 'Learning Center',
      description: 'Short lessons on wallets, fees, and security',
      icon: Icons.menu_book_outlined,
      builder: (_) => const LearningCenterScreen(),
    ),
    _Category(
      title: 'Support',
      description: 'FAQ, guides, and ways to get help',
      icon: Icons.help_outline_rounded,
      builder: (_) => const HelpSupportScreen(),
    ),
    _Category(
      title: 'About',
      description: 'Version, legal, and acknowledgements',
      icon: Icons.info_outline_rounded,
      builder: (_) => const AboutScreen(),
    ),
    _Category(
      title: 'Diagnostics',
      description: 'Developer sync health, cache, and export — support only',
      icon: Icons.monitor_heart_outlined,
      builder: (_) => const DiagnosticsScreen(),
    ),
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bootstrapped) return;
    _bootstrapped = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PreferencesController>().bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _categories
        : _categories
            .where(
              (c) =>
                  c.title.toLowerCase().contains(q) ||
                  c.description.toLowerCase().contains(q),
            )
            .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        actions: [
          IconButton(
            tooltip: 'Notification center',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const NotificationCenterScreen()),
            ),
            icon: Badge(
              isLabelVisible: prefs.unreadCount > 0,
              label: Text('${prefs.unreadCount}'),
              child: const Icon(Icons.inbox_outlined),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          const Text(
            'Find what you need — clear categories, short descriptions, advanced options only when you ask.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 16),
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search settings',
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: 8),
          if (filtered.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 32),
              child: Text('No matches. Try another word or clear search.'),
            )
          else
            for (final c in filtered)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(c.icon, color: AetherColors.lagoon),
                title: Text(c.title),
                subtitle: Text(c.description, style: const TextStyle(height: 1.35)),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: c.builder),
                ),
              ),
        ],
      ),
    );
  }
}
