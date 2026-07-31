import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../connections/connections_controller.dart';
import '../../connections/models.dart';
import '../../connections/permission_catalog.dart';
import '../../connections/signature_intelligence.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../home/home_shared.dart';
import 'connect_dapp_screen.dart';
import 'connection_approval_sheet.dart';
import 'connections_auth.dart';
import 'dapp_transaction_request_sheet.dart';
import 'signature_request_sheet.dart';
import 'web3_activity_screen.dart';

class PermissionCenterScreen extends StatefulWidget {
  const PermissionCenterScreen({super.key});

  @override
  State<PermissionCenterScreen> createState() => _PermissionCenterScreenState();
}

class _PermissionCenterScreenState extends State<PermissionCenterScreen> {
  bool _bootstrapped = false;
  String _query = '';
  String _sort = 'activity';
  String _filter = 'active';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bootstrapped) return;
    _bootstrapped = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ConnectionsController>().bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final connections = context.watch<ConnectionsController>();
    final wallet = context.watch<WalletController>();
    final sessions = connections.sessions.where((s) {
      if (_filter == 'active' && !s.active) return false;
      if (_filter == 'inactive' && s.active) return false;
      if (_filter == 'elevated') {
        final elevated = s.activePermissionCodes.contains(DappPermissionCode.requestTransactions) ||
            s.warning != null;
        if (!elevated || !s.active) return false;
      }
      if (_query.trim().isEmpty) return true;
      final q = _query.trim().toLowerCase();
      return s.label.toLowerCase().contains(q) || s.origin.toLowerCase().contains(q);
    }).toList()
      ..sort((a, b) {
        if (_sort == 'name') return a.label.toLowerCase().compareTo(b.label.toLowerCase());
        return b.lastUsedAt.compareTo(a.lastUsedAt);
      });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Permission Center'),
        actions: [
          IconButton(
            tooltip: 'Web3 activity',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const Web3ActivityScreen()),
            ),
            icon: const Icon(Icons.history_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const ConnectDappScreen()),
        ),
        icon: const Icon(Icons.add_link_rounded),
        label: const Text('Connect'),
      ),
      body: connections.loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
              children: [
                const Text(
                  'See who can ask this wallet for access, revoke permissions, and disconnect anytime.',
                  style: TextStyle(color: AetherColors.muted, height: 1.45),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Sessions below are preview/local unless a live connections API is linked later.',
                  style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
                ),
                const SizedBox(height: 12),
                if (connections.activeSessions.isNotEmpty)
                  OutlinedButton.icon(
                    onPressed: () async {
                      final ok = await authenticateConnectionsAction(
                        context,
                        wallet,
                        reason: 'Confirm before disconnecting all apps',
                      );
                      if (!ok) return;
                      final count = await connections.disconnectAllSessions();
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Disconnected $count app${count == 1 ? '' : 's'}')),
                      );
                    },
                    icon: const Icon(Icons.link_off_rounded),
                    label: const Text('Disconnect all apps'),
                  ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          hintText: 'Search apps or websites',
                          border: OutlineInputBorder(),
                        ),
                        onChanged: (value) => setState(() => _query = value),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Active'),
                      selected: _filter == 'active',
                      onSelected: (_) => setState(() => _filter = 'active'),
                    ),
                    ChoiceChip(
                      label: const Text('All'),
                      selected: _filter == 'all',
                      onSelected: (_) => setState(() => _filter = 'all'),
                    ),
                    ChoiceChip(
                      label: const Text('Inactive'),
                      selected: _filter == 'inactive',
                      onSelected: (_) => setState(() => _filter = 'inactive'),
                    ),
                    ChoiceChip(
                      label: const Text('Elevated risk'),
                      selected: _filter == 'elevated',
                      onSelected: (_) => setState(() => _filter = 'elevated'),
                    ),
                    ChoiceChip(
                      label: const Text('Sort: recent'),
                      selected: _sort == 'activity',
                      onSelected: (_) => setState(() => _sort = 'activity'),
                    ),
                    ChoiceChip(
                      label: const Text('Sort: name'),
                      selected: _sort == 'name',
                      onSelected: (_) => setState(() => _sort = 'name'),
                    ),
                  ],
                ),
                if (connections.pendingRequests.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text('Waiting for your decision', style: Theme.of(context).textTheme.titleMedium),
                  for (final req in connections.pendingRequests)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(req.appName),
                      subtitle: Text(req.origin),
                      trailing: TextButton(
                        onPressed: () async {
                          await showConnectionApprovalSheet(context, request: req);
                        },
                        child: const Text('Review'),
                      ),
                    ),
                ],
                const SizedBox(height: 18),
                Text('Connected apps', style: Theme.of(context).textTheme.titleMedium),
                if (sessions.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Text(
                      'No connections yet. Use Connect to pair with a trusted app.',
                      style: TextStyle(color: AetherColors.muted),
                    ),
                  )
                else
                  for (final session in sessions)
                    _SessionCard(
                      session: session,
                      onOpen: () => _openDetail(context, connections, wallet, session),
                    ),
              ],
            ),
    );
  }

  Future<void> _openDetail(
    BuildContext context,
    ConnectionsController connections,
    WalletController wallet,
    ConnectedAppSession session,
  ) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _SessionDetailScreen(sessionId: session.id),
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.session, required this.onOpen});

  final ConnectedAppSession session;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(top: 10),
      child: ListTile(
        onTap: onOpen,
        leading: CircleAvatar(
          backgroundColor: AetherColors.lagoon.withValues(alpha: 0.12),
          child: Text(
            session.faviconHint ?? session.label.substring(0, 1).toUpperCase(),
            style: const TextStyle(color: AetherColors.lagoon, fontWeight: FontWeight.w700),
          ),
        ),
        title: Text(session.label),
        subtitle: Text(
          '${session.origin}\n${session.activePermissionCodes.length} permissions · ${relativeTime(session.lastUsedAt)}'
          '${session.active ? '' : ' · disconnected'}'
          '${session.isExpired ? ' · expired' : ''}'
          '${session.expiresAt != null && session.active ? ' · expires ${relativeTime(session.expiresAt!)}' : ''}',
        ),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}

class _SessionDetailScreen extends StatelessWidget {
  const _SessionDetailScreen({required this.sessionId});

  final String sessionId;

  @override
  Widget build(BuildContext context) {
    final connections = context.watch<ConnectionsController>();
    final wallet = context.watch<WalletController>();
    final session = connections.sessions.firstWhere((s) => s.id == sessionId);

    return Scaffold(
      appBar: AppBar(title: Text(session.label)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          Text(session.origin, style: const TextStyle(color: AetherColors.muted)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final chip in session.trust.chips)
                Chip(label: Text(chip)),
              if (!session.trust.anyVerified)
                const Chip(label: Text('We can’t verify this site yet')),
            ],
          ),
          const SizedBox(height: 12),
          Text('Networks: ${session.networks.join(', ')}'),
          Text('Accounts: ${session.accounts.join(', ')}'),
          Text('Method: ${session.method.label}'),
          Text('Protocol: WalletConnect v${session.protocolVersion}'),
          if (session.topic != null) Text('Topic: ${session.topic}'),
          Text('Connected ${relativeTime(session.connectedAt)} · Last used ${relativeTime(session.lastUsedAt)}'),
          if (session.expiresAt != null)
            Text(session.isExpired
                ? 'Expired ${relativeTime(session.expiresAt!)}'
                : 'Expires ${relativeTime(session.expiresAt!)}'),
          if (session.lastRestoredAt != null)
            Text('Last restored ${relativeTime(session.lastRestoredAt!)}'),
          ...[
            const SizedBox(height: 10),
            for (final tip in SignatureIntelligence.connectionTips(
              DappConnectionRequest(
                id: session.id,
                appName: session.appName,
                origin: session.origin,
                networks: session.networks,
                account: session.accounts.isNotEmpty ? session.accounts.first : 'Primary',
                permissions: session.activePermissionCodes,
                method: session.method,
                createdAt: session.connectedAt,
                status: ConnectionRequestStatus.approved,
                trust: session.trust,
              ),
            ))
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text('• $tip', style: const TextStyle(height: 1.4, color: AetherColors.muted)),
              ),
          ],
          if (session.warning != null) ...[
            const SizedBox(height: 8),
            Text(session.warning!, style: const TextStyle(color: Color(0xFFB54708))),
          ],
          const SizedBox(height: 18),
          Text('Permissions', style: Theme.of(context).textTheme.titleMedium),
          for (final grant in session.grants)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                permissionInfoFor(grant.code).title,
                style: TextStyle(
                  decoration: grant.revoked ? TextDecoration.lineThrough : null,
                ),
              ),
              subtitle: Text(
                '${permissionInfoFor(grant.code).explanation}\nLast used ${grant.lastUsedAt == null ? 'never' : relativeTime(grant.lastUsedAt!)}',
              ),
              isThreeLine: true,
              trailing: grant.revoked
                  ? const Text('Revoked', style: TextStyle(color: AetherColors.muted))
                  : TextButton(
                      onPressed: () async {
                        final ok = await authenticateConnectionsAction(
                          context,
                          wallet,
                          reason: 'Confirm before revoking this permission',
                        );
                        if (!ok) return;
                        await connections.revokePermission(sessionId: session.id, grantId: grant.id);
                      },
                      child: const Text('Revoke'),
                    ),
            ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              OutlinedButton(
                onPressed: () async {
                  final ctrl = TextEditingController(text: session.displayName ?? session.appName);
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Rename connection'),
                      content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Name')),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
                      ],
                    ),
                  );
                  if (ok == true) await connections.renameSession(session.id, ctrl.text);
                  ctrl.dispose();
                },
                child: const Text('Rename'),
              ),
              if (session.active)
                OutlinedButton(
                  onPressed: () async {
                    final ok = await authenticateConnectionsAction(
                      context,
                      wallet,
                      reason: 'Confirm before disconnecting ${session.label}',
                    );
                    if (!ok) return;
                    await connections.disconnectSession(session.id);
                    if (context.mounted) Navigator.pop(context);
                  },
                  child: const Text('Disconnect'),
                )
              else
                OutlinedButton(
                  onPressed: () async {
                    final ok = await authenticateConnectionsAction(
                      context,
                      wallet,
                      reason: 'Confirm before reconnecting ${session.label}',
                    );
                    if (!ok || !context.mounted) return;
                    final request = await connections.reconnectSession(session.id);
                    if (!context.mounted) return;
                    final approved = await showConnectionApprovalSheet(context, request: request);
                    if (approved == true && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Reconnected after fresh approval (preview)')),
                      );
                      Navigator.pop(context);
                    }
                  },
                  child: const Text('Reconnect'),
                ),
              if (!session.active && !session.isExpired)
                OutlinedButton(
                  onPressed: () async {
                    final ok = await authenticateConnectionsAction(
                      context,
                      wallet,
                      reason: 'Confirm before restoring ${session.label}',
                    );
                    if (!ok) return;
                    final restored = await connections.restoreSession(session.id);
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          restored?.active == true
                              ? 'Session restored'
                              : 'Could not restore — use Reconnect for fresh approval',
                        ),
                      ),
                    );
                  },
                  child: const Text('Restore session'),
                ),
              if (session.active) ...[
                FilledButton.tonal(
                  onPressed: () async {
                    final req = await connections.enqueueSignatureRequest(sessionId: session.id);
                    if (!context.mounted) return;
                    await showSignatureRequestSheet(context, request: req);
                  },
                  child: const Text('Demo signature'),
                ),
                FilledButton.tonal(
                  onPressed: () async {
                    final req = await connections.enqueueTransactionRequest(sessionId: session.id);
                    if (!context.mounted) return;
                    await showDappTransactionRequestSheet(context, request: req);
                  },
                  child: const Text('Demo transaction'),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
