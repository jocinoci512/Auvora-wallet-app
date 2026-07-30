import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../theme/aether_theme.dart';
import '../../wallet_engine/models.dart';
import '../../wallet_engine/network_manager.dart';
import '../../wallet_engine/sync_coordinator.dart';
import '../../wallet_engine/sync_engine.dart';

/// Developer / support diagnostics — no keys, seeds, or PINs.
class DiagnosticsScreen extends StatefulWidget {
  const DiagnosticsScreen({super.key});

  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen> {
  String? _toast;

  Map<String, Object?> _payload(BuildContext context) {
    final sync = context.read<SyncEngine>();
    final network = context.read<NetworkManager>();
    final coordinator = context.read<SyncCoordinator>();
    return sync.exportDiagnostics(
      coordinator: {
        'reconnectRefreshCount': coordinator.reconnectRefreshCount,
        'coalescedCount': coordinator.coalescedCount,
        'lastTriggeredAt': coordinator.lastTriggeredAt?.toIso8601String(),
        'networkPingRetries': network.pingRetries,
      },
    );
  }

  Future<void> _export(BuildContext context) async {
    final json = const JsonEncoder.withIndent('  ').convert(_payload(context));
    await Clipboard.setData(ClipboardData(text: json));
    setState(() => _toast = 'Diagnostics JSON copied — no secrets included.');
  }

  Future<void> _clearCache(BuildContext context) async {
    await context.read<SyncEngine>().clearCaches();
    setState(() => _toast = 'Local cache cleared. Pull to refresh on Home.');
  }

  @override
  Widget build(BuildContext context) {
    final sync = context.read<SyncEngine>();
    final network = context.watch<NetworkManager>();
    final coordinator = context.watch<SyncCoordinator>();
    final d = sync.diagnostics;
    final status = sync.syncStatus;

    return Scaffold(
      appBar: AppBar(title: const Text('Diagnostics')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Developer and support only. Counters stay on this device. Keys and recovery phrases are never exported.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          if (_toast != null) ...[
            const SizedBox(height: 12),
            Text(_toast!, style: const TextStyle(color: AetherColors.lagoon)),
          ],
          const SizedBox(height: 16),
          _tile('Sync state', status.state.name),
          _tile('Last updated', status.lastUpdatedAt.toIso8601String()),
          _tile('From cache', status.fromCache ? 'yes' : 'no'),
          _tile('Offline', status.offline ? 'yes' : 'no'),
          _tile('Failed chains', status.failedChains.isEmpty ? 'none' : status.failedChains.join(', ')),
          _tile('Cache hits / misses', '${d.cacheHits} / ${d.cacheMisses}'),
          _tile('RPC requests / failures', '${d.rpcRequests} / ${d.rpcFailures}'),
          _tile('Retries', '${d.retryAttempts}'),
          _tile('Partial chain failures', '${d.partialChainFailures}'),
          _tile('Avg latency', '${d.averageLatencyMs} ms'),
          _tile('Cold start', d.coldStartMs == null ? 'n/a' : '${d.coldStartMs} ms'),
          _tile('Reconnect refreshes', '${coordinator.reconnectRefreshCount}'),
          _tile('Coalesced syncs', '${coordinator.coalescedCount}'),
          const SizedBox(height: 8),
          Text('Endpoints', style: Theme.of(context).textTheme.titleMedium),
          for (final ep in network.allStatuses)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(ep.chain.label),
              subtitle: Text('${ep.state.name} · ${ep.latencyMs} ms · ${ep.endpoint}'),
            ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => _export(context),
            child: const Text('Copy diagnostics JSON'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => _clearCache(context),
            child: const Text('Clear local cache'),
          ),
        ],
      ),
    );
  }

  Widget _tile(String label, String value) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(value, style: const TextStyle(height: 1.35)),
    );
  }
}
