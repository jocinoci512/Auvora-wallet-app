import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../connections/connections_controller.dart';
import '../../connections/known_catalog.dart';
import '../../connections/models.dart';
import '../../connections/permission_catalog.dart';
import '../../intelligence/catalog.dart';
import '../../intelligence/intelligence_controller.dart';
import '../../intelligence/models.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../intelligence/intelligence_tip.dart';
import '../intelligence/learning_center_screen.dart';
import 'connections_auth.dart';

Future<bool?> showConnectionApprovalSheet(
  BuildContext context, {
  required DappConnectionRequest request,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => _ConnectionApprovalBody(request: request),
  );
}

class _ConnectionApprovalBody extends StatelessWidget {
  const _ConnectionApprovalBody({required this.request});

  final DappConnectionRequest request;

  @override
  Widget build(BuildContext context) {
    final connections = context.read<ConnectionsController>();
    final wallet = context.read<WalletController>();
    final positive = <String>[
      if (request.trust.verifiedDomain || request.trust.knownProject)
        'In Auvora catalog (not attestation)',
      if (request.trust.https) 'HTTPS',
      if (request.trust.previouslyConnected) 'Previously connected',
    ];
    final caution = <String>[
      if (!request.trust.anyVerified) 'We can’t verify this site yet',
      if (!request.trust.https) 'Not HTTPS',
      if (request.trust.unknownApplication) 'Unknown application',
      if (request.trust.recentlyRegisteredHint) 'Newly seen domain',
    ];
    final canMove = permissionsCanMoveFunds(request.permissions);

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.88,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AetherColors.border,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Connection request', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 6),
            const Text(
              'Review who is asking, what they can request, and any caution notes — then approve or reject.',
              style: TextStyle(color: AetherColors.muted, height: 1.45),
            ),
            if (context.watch<IntelligenceController>().shouldShowExplanation(IntelligenceKind.security)) ...[
              const SizedBox(height: 12),
              Builder(
                builder: (context) {
                  final intel = context.read<IntelligenceController>();
                  final explanation = IntelligenceCatalog.explainConnection(
                    origin: request.origin,
                    lookalike: lookalikeHint(request.origin) != null,
                    unknown: !request.trust.anyVerified,
                  );
                  return IntelligenceExplainPanel(
                    explanation: explanation,
                    compact: intel.useCompactExplanation(explanation),
                    onLearnMore: explanation.learnTopicId == null
                        ? null
                        : () => openLesson(context, explanation.learnTopicId),
                  );
                },
              ),
            ],
            const SizedBox(height: 14),
            _InfoCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('What you’re allowing today', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 6),
                  Text(
                    permissionConsentSummary(request.permissions),
                    style: const TextStyle(height: 1.45, fontWeight: FontWeight.w600),
                  ),
                  if (canMove) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Risk · ${riskLabel(highestRisk(request.permissions))}',
                      style: const TextStyle(color: Color(0xFFB54708), fontWeight: FontWeight.w600),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            _InfoCard(
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AetherColors.lagoon.withValues(alpha: 0.12),
                    child: Text(
                      request.faviconHint ?? request.appName.substring(0, 1).toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AetherColors.lagoon),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(request.appName, style: Theme.of(context).textTheme.titleLarge),
                        Text(request.origin, style: const TextStyle(color: AetherColors.muted)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (positive.isNotEmpty) ...[
              const Text('Signals present', style: TextStyle(fontSize: 12, color: AetherColors.muted)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [for (final chip in positive) _Chip(label: chip, warning: false)],
              ),
              const SizedBox(height: 10),
            ],
            if (caution.isNotEmpty) ...[
              const Text('Missing verification', style: TextStyle(fontSize: 12, color: AetherColors.muted)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [for (final chip in caution) _Chip(label: chip, warning: true)],
              ),
            ],
            const SizedBox(height: 16),
            _kv('Connection method', request.method.label),
            _kv('Network', request.networks.join(', ')),
            _kv('Wallet account', request.account),
            _kv('Requested', _formatWhen(request.createdAt)),
            const SizedBox(height: 16),
            Text('Permissions', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final code in request.permissions)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  permissionInfoFor(code).canMoveFunds
                      ? Icons.warning_amber_rounded
                      : Icons.check_circle_outline,
                  color: permissionInfoFor(code).canMoveFunds
                      ? const Color(0xFFB54708)
                      : AetherColors.lagoon,
                ),
                title: Text(permissionInfoFor(code).title),
                subtitle: Text(permissionInfoFor(code).explanation),
              ),
            if (request.riskWarnings.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('Before you continue', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              for (final note in request.riskWarnings)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text('• $note', style: const TextStyle(height: 1.4)),
                ),
            ],
            const SizedBox(height: 8),
            const Text(
              'Preview session — this is WalletConnect-shaped pairing, not a live relay connection.',
              style: TextStyle(color: AetherColors.muted, height: 1.4, fontSize: 13),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () async {
                final ok = await authenticateConnectionsAction(
                  context,
                  wallet,
                  reason: 'Confirm before connecting ${request.appName}',
                );
                if (!ok || !context.mounted) return;
                final intelligence = context.read<IntelligenceController>();
                final navigator = Navigator.of(context);
                await connections.approveConnection(request.id);
                intelligence.noteEvent('onWeb3Connect');
                if (!context.mounted) return;
                navigator.pop(true);
              },
              child: const Text('Approve connection'),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: () async {
                await connections.rejectConnection(request.id);
                if (context.mounted) Navigator.pop(context, false);
              },
              child: const Text('Reject'),
            ),
          ],
        );
      },
    );
  }

  Widget _kv(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label, style: const TextStyle(color: AetherColors.muted)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }

  String _formatWhen(DateTime value) {
    final local = value.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    final h = local.hour.toString().padLeft(2, '0');
    final min = local.minute.toString().padLeft(2, '0');
    return '$y-$m-$d · $h:$min';
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AetherColors.border),
      ),
      child: child,
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.warning});
  final String label;
  final bool warning;

  @override
  Widget build(BuildContext context) {
    final color = warning ? const Color(0xFFB54708) : AetherColors.lagoon;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: warning ? color.withValues(alpha: 0.35) : AetherColors.border),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: warning ? color : null),
      ),
    );
  }
}
