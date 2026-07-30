import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../preferences/models.dart';
import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';

class AppearanceSettingsScreen extends StatelessWidget {
  const AppearanceSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();

    return Scaffold(
      appBar: AppBar(title: const Text('Appearance')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Theme and formats update instantly on this device. Language packs can plug in later without redesign.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 16),
          Text('Theme', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final t in AppThemePreference.values)
                ChoiceChip(
                  label: Text(t.name),
                  selected: prefs.theme == t,
                  onSelected: (_) => prefs.setTheme(t),
                ),
            ],
          ),
          const SizedBox(height: 20),
          Text('Language framework', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          const Text(
            'UI strings are English in this release. Region and formats below control how numbers and dates appear.',
            style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Language'),
            subtitle: Text(prefs.locale.languageCode == 'en' ? 'English' : prefs.locale.languageCode),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Region'),
            subtitle: Text(prefs.locale.regionCode),
          ),
          const SizedBox(height: 8),
          Text('Date format', style: Theme.of(context).textTheme.titleSmall),
          Wrap(
            spacing: 8,
            children: [
              for (final d in DateFormatPreference.values)
                ChoiceChip(
                  label: Text(d.name.toUpperCase()),
                  selected: prefs.locale.dateFormat == d,
                  onSelected: (_) => prefs.setLocale(prefs.locale.copyWith(dateFormat: d)),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text('Time format', style: Theme.of(context).textTheme.titleSmall),
          Wrap(
            spacing: 8,
            children: [
              for (final t in TimeFormatPreference.values)
                ChoiceChip(
                  label: Text(t == TimeFormatPreference.h12 ? '12-hour' : '24-hour'),
                  selected: prefs.locale.timeFormat == t,
                  onSelected: (_) => prefs.setLocale(prefs.locale.copyWith(timeFormat: t)),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text('Currency format', style: Theme.of(context).textTheme.titleSmall),
          Wrap(
            spacing: 8,
            children: [
              for (final c in FiatCurrency.values)
                ChoiceChip(
                  label: Text(currencyCode(c)),
                  selected: prefs.locale.currency == c,
                  onSelected: (_) => prefs.setLocale(prefs.locale.copyWith(currency: c)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
