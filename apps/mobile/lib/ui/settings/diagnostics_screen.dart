import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../release/integration_config.dart';
import '../../theme/aether_theme.dart';
import '../../wallet_engine/models.dart';
import '../../wallet_engine/network_manager.dart';
import '../../wallet_engine/sync_coordinator.dart';
import '../../wallet_engine/sync_engine.dart';
import '../home/home_shared.dart';

/// Developer / support diagnostics — no keys, seeds, or PINs.
class DiagnosticsScreen extends StatefulWidget {
  const DiagnosticsScreen({super.key});

  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen> {
  String? _toast;
  Map<String, int> _cacheSizes = const {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadCacheSizes());
  }

  Future<void> _loadCacheSizes() async {
    final sizes = await context.read<SyncEngine>().cacheStore.namespaceSizes();
    if (!mounted) return;
    setState(() => _cacheSizes = sizes);
  }

  Future<void> _export(BuildContext context) async {
    final sync = context.read<SyncEngine>();
    final coordinator = context.read<SyncCoordinator>();
    final network = context.read<NetworkManager>();
    final json = const JsonEncoder.withIndent('  ').convert(
      await sync.exportDiagnosticsAsync(
        coordinator: {
          ...coordinator.diagnosticsJson(),
          'networkPingRetries': network.pingRetries,
          'networkFailoverAttempts': network.failoverAttempts,
          'networkTimeoutEvents': network.timeoutEvents,
        },
      ),
    );
    await Clipboard.setData(ClipboardData(text: json));
    setState(() => _toast = 'Diagnostics JSON copied — no secrets included.');
  }

  Future<void> _clearCache(BuildContext context) async {
    await context.read<SyncEngine>().clearCaches();
    await _loadCacheSizes();
    setState(() => _toast = 'Local cache cleared. Pull to refresh on Home.');
  }

  Future<void> _purgeExpired(BuildContext context) async {
    final n = await context.read<SyncEngine>().purgeExpiredCache();
    await _loadCacheSizes();
    setState(() => _toast = 'Purged $n expired cache entries.');
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
          const SizedBox(height: 12),
          const SoftBanner(
            message:
                'OS background sync (WorkManager) is not wired in Version 1.0 Alpha. '
                'Refresh runs on app resume (connectivity probe first), reconnect, pull-to-refresh, '
                'pending-tx foreground polls, and periodic health checks. Device-local activity is persisted and merged on sync.',
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
          _tile('Network requests / failures', '${d.rpcRequests} / ${d.rpcFailures}'),
          _tile('Retries', '${d.retryAttempts}'),
          _tile('Partial chain failures', '${d.partialChainFailures}'),
          _tile('Error events', '${d.errorEvents}'),
          _tile('Avg latency', '${d.averageLatencyMs} ms'),
          _tile('Last sync duration', d.lastSyncDurationMs == null ? 'n/a' : '${d.lastSyncDurationMs} ms'),
          _tile('Sync samples', '${d.syncSampleCount}'),
          _tile('Cold start', d.coldStartMs == null ? 'n/a' : '${d.coldStartMs} ms'),
          _tile('Reconnect refreshes', '${coordinator.reconnectRefreshCount}'),
          _tile('Resume refreshes', '${coordinator.resumeRefreshCount}'),
          _tile('Pending-tx refreshes', '${coordinator.pendingTxRefreshCount}'),
          _tile('Coalesced syncs', '${coordinator.coalescedCount}'),
          _tile('Offline queue drained', '${coordinator.offlineQueueDrained}'),
          _tile('RPC failovers / timeouts', '${network.failoverAttempts} / ${network.timeoutEvents}'),
          _tile(
            'RPC health probes',
            IntegrationConfig.rpcHealthProbeEnabled ? 'enabled (public/configured URLs)' : 'disabled',
          ),
          _tile(
            'Integrations readiness',
            IntegrationConfig.readinessSummary().entries
                .map((e) => '${e.key}:${e.value}')
                .join(' · '),
          ),
          if (_cacheSizes.isNotEmpty)
            _tile(
              'Cache namespaces',
              _cacheSizes.entries.map((e) => '${e.key}:${e.value}').join(', '),
            ),
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
            onPressed: () => _purgeExpired(context),
            child: const Text('Purge expired cache'),
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
