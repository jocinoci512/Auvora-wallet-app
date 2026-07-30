import 'package:flutter/material.dart';

import '../../theme/aether_theme.dart';
import '../home/home_shared.dart';

/// Mirrors pubspec version — keep in sync when shipping store builds.
const kAppVersion = '1.0.0';
const kAppBuild = '1';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          Text('Auvora Wallet', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          const Text(
            'Version $kAppVersion · Build $kAppBuild',
            style: TextStyle(color: AetherColors.muted),
          ),
          const SizedBox(height: 20),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Release notes'),
            subtitle: const Text('What changed in recent builds'),
            onTap: () => showActionSheet(
              context,
              title: 'Release notes',
              body:
                  'Sprint 8: Settings Center, Notification Center, price alerts, appearance, privacy, networks, accessibility, help, and about — preview-first on this device.',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Privacy policy'),
            onTap: () => showActionSheet(
              context,
              title: 'Privacy policy',
              body: 'Draft policy lives on web at /legal. Keys never leave this device for analytics.',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Terms of service'),
            onTap: () => showActionSheet(
              context,
              title: 'Terms of service',
              body: 'Draft terms live on web at /legal. Preview features are labeled and not live chain guarantees.',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Open-source acknowledgements'),
            onTap: () => showActionSheet(
              context,
              title: 'Acknowledgements',
              body:
                  'Auvora builds on Flutter, Provider, SharedPreferences, mobile_scanner, and related open-source packages. Full license texts ship with the store build.',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Licenses'),
            onTap: () => showLicensePage(
              context: context,
              applicationName: 'Auvora Wallet',
              applicationVersion: kAppVersion,
            ),
          ),
        ],
      ),
    );
  }
}
