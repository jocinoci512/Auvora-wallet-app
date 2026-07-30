import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../connections/connections_controller.dart';
import '../../connections/models.dart';
import '../../theme/aether_theme.dart';
import '../home/home_shared.dart';

class Web3ActivityScreen extends StatefulWidget {
  const Web3ActivityScreen({super.key});

  @override
  State<Web3ActivityScreen> createState() => _Web3ActivityScreenState();
}

class _Web3ActivityScreenState extends State<Web3ActivityScreen> {
  String _query = '';
  Web3ActivityKind? _kind;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ConnectionsController>().bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final connections = context.watch<ConnectionsController>();
    final events = connections.activity.where((event) {
      if (_kind != null && event.kind != _kind) return false;
      if (_query.trim().isEmpty) return true;
      final q = _query.trim().toLowerCase();
      return event.title.toLowerCase().contains(q) ||
          event.detail.toLowerCase().contains(q) ||
          (event.origin?.toLowerCase().contains(q) ?? false) ||
          (event.appName?.toLowerCase().contains(q) ?? false);
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Web3 activity')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          const Text(
            'Connections, approvals, signatures, and dApp transactions on this device. Preview history only — not a live WalletConnect feed.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search by app or website',
              border: OutlineInputBorder(),
            ),
            onChanged: (value) => setState(() => _query = value),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('All'),
                selected: _kind == null,
                onSelected: (_) => setState(() => _kind = null),
              ),
              for (final kind in Web3ActivityKind.values)
                ChoiceChip(
                  label: Text(_kindLabel(kind)),
                  selected: _kind == kind,
                  onSelected: (_) => setState(() => _kind = kind),
                ),
            ],
          ),
          const SizedBox(height: 16),
          if (events.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Text('No matching activity yet.', style: TextStyle(color: AetherColors.muted)),
            )
          else
            for (final event in events)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(_iconFor(event.kind), color: AetherColors.lagoon),
                title: Text(event.title),
                subtitle: Text(
                  '${event.detail}\n${event.origin ?? ''} · ${relativeTime(event.timestamp)} · ${event.status.name}',
                ),
                isThreeLine: true,
              ),
        ],
      ),
    );
  }

  String _kindLabel(Web3ActivityKind kind) {
    return switch (kind) {
      Web3ActivityKind.connected => 'Connected',
      Web3ActivityKind.disconnected => 'Disconnected',
      Web3ActivityKind.approved => 'Approved',
      Web3ActivityKind.rejected => 'Rejected',
      Web3ActivityKind.signature => 'Signatures',
      Web3ActivityKind.dappTransaction => 'Transactions',
      Web3ActivityKind.permissionRevoked => 'Revokes',
      Web3ActivityKind.renamed => 'Renames',
    };
  }

  IconData _iconFor(Web3ActivityKind kind) {
    return switch (kind) {
      Web3ActivityKind.connected => Icons.link_rounded,
      Web3ActivityKind.disconnected => Icons.link_off_rounded,
      Web3ActivityKind.approved => Icons.check_circle_outline,
      Web3ActivityKind.rejected => Icons.cancel_outlined,
      Web3ActivityKind.signature => Icons.draw_outlined,
      Web3ActivityKind.dappTransaction => Icons.swap_horiz_rounded,
      Web3ActivityKind.permissionRevoked => Icons.remove_circle_outline,
      Web3ActivityKind.renamed => Icons.edit_outlined,
    };
  }
}
