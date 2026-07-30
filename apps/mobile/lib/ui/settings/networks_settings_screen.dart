import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';

class NetworksSettingsScreen extends StatefulWidget {
  const NetworksSettingsScreen({super.key});

  @override
  State<NetworksSettingsScreen> createState() => _NetworksSettingsScreenState();
}

class _NetworksSettingsScreenState extends State<NetworksSettingsScreen> {
  bool _advanced = false;

  static const _networks = <(String, String, String)>[
    ('ETHEREUM', 'Healthy', 'rpc-preview · 42ms'),
    ('BITCOIN', 'Healthy', 'rpc-preview · 58ms'),
    ('SOLANA', 'Degraded', 'rpc-preview · 210ms'),
    ('POLYGON', 'Healthy', 'rpc-preview · 51ms'),
  ];

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final selected = prefs.walletDisplay.defaultNetwork;

    return Scaffold(
      appBar: AppBar(title: const Text('Networks')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Pick a default network for new actions. Status below is preview health — not live SLA.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 16),
          for (final n in _networks)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                selected == n.$1 ? Icons.radio_button_checked : Icons.radio_button_off,
                color: AetherColors.lagoon,
              ),
              title: Text(n.$1),
              subtitle: Text('${n.$2} · ${n.$3}'),
              onTap: () => prefs.setWalletDisplay(prefs.walletDisplay.copyWith(defaultNetwork: n.$1)),
            ),
          const SizedBox(height: 12),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('Advanced'),
            subtitle: const Text('RPC cache and technical options'),
            initiallyExpanded: _advanced,
            onExpansionChanged: (v) => setState(() => _advanced = v),
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Reset network cache'),
                subtitle: Text(
                  prefs.networkCacheResetAt == null
                      ? 'Clears preview RPC cache on this device'
                      : 'Last reset ${prefs.networkCacheResetAt!.toLocal()}',
                ),
                trailing: TextButton(
                  onPressed: () => prefs.resetNetworkCache(),
                  child: const Text('Reset'),
                ),
              ),
              const ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('Custom RPC endpoints'),
                subtitle: Text('Not available in this preview — coming with live provider wiring.'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
