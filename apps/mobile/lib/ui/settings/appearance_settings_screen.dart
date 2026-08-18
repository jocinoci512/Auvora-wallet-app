import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../l10n/auvora_locale.dart';
import '../../preferences/models.dart';
import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';

class AppearanceSettingsScreen extends StatelessWidget {
  const AppearanceSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final localeHelper = AuvoraLocale(prefs.locale);

    return Scaffold(
      appBar: AppBar(title: Text(AuvoraStrings.lookup('appearance.theme') == 'Theme' ? 'Appearance' : 'Appearance')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Theme, language, and formats update on this device. Recovery-phrase words stay BIP-39 English.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 16),
          Text(AuvoraStrings.lookup('appearance.theme'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final t in AppThemePreference.values)
                ChoiceChip(
                  label: Text(switch (t) {
                    AppThemePreference.system => 'System',
                    AppThemePreference.light => 'Light',
                    AppThemePreference.dark => 'Dark',
                  }),
                  selected: prefs.theme == t,
                  onSelected: (_) => prefs.setTheme(t),
                ),
            ],
          ),
          const SizedBox(height: 20),
          Text(AuvoraStrings.lookup('appearance.accent'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            AuvoraStrings.lookup('appearance.accent_hint'),
            style: const TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final a in AccentColorPreference.values)
                ChoiceChip(
                  avatar: CircleAvatar(backgroundColor: accentColorFor(a), radius: 8),
                  label: Text(a.name),
                  selected: prefs.accent == a,
                  onSelected: (_) => prefs.setAccent(a),
                ),
            ],
          ),
          const SizedBox(height: 20),
          Text('Language', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          const Text(
            'App language is separate from your BIP-39 recovery phrase. Recovery words stay English so the wallet can be restored in any compatible client.',
            style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: prefs.locale.languageCode,
            decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Display language'),
            items: [
              for (final pack in kLanguagePackCatalog)
                DropdownMenuItem(value: pack.code, child: Text(pack.label)),
            ],
            onChanged: (code) {
              if (code == null) return;
              prefs.setLocale(prefs.locale.copyWith(languageCode: code));
            },
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Region'),
            subtitle: Text(prefs.locale.regionCode),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Text direction'),
            subtitle: Text(localeHelper.isRtl ? 'Right-to-left ready' : 'Left-to-right'),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Format preview'),
            subtitle: Text(
              '${localeHelper.formatCurrency(1234.56)} · ${localeHelper.formatDateTime(DateTime.now())}',
            ),
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
