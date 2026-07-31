import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../connections/connections_controller.dart';
import '../../connections/models.dart';
import '../../connections/permission_catalog.dart';
import '../../connections/signature_intelligence.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import 'connections_auth.dart';

Future<bool?> showSignatureRequestSheet(
  BuildContext context, {
  required SignatureRequest request,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _SignatureBody(request: request),
  );
}

class _SignatureBody extends StatelessWidget {
  const _SignatureBody({required this.request});
  final SignatureRequest request;

  @override
  Widget build(BuildContext context) {
    final connections = context.read<ConnectionsController>();
    final wallet = context.read<WalletController>();
    final intel = SignatureIntelligence.forSignature(request);

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Signature request', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(request.appName, style: Theme.of(context).textTheme.titleMedium),
            Text(request.origin, style: const TextStyle(color: AetherColors.muted)),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AetherColors.border),
                color: Theme.of(context).colorScheme.surface,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(intel.headline, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35)),
                  const SizedBox(height: 8),
                  for (final bullet in intel.bullets)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text('• $bullet', style: const TextStyle(height: 1.4)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _row('Why', request.purpose),
            _row('What you are signing', request.payloadSummary),
            _row('Wallet signing', request.walletLabel),
            _row('Network', request.network),
            _row(
              'Can this move funds?',
              request.canMoveFunds
                  ? 'It can authorize spending later — review carefully'
                  : 'Not from this message alone',
            ),
            _row('Estimated risk', riskLabel(request.risk)),
            if (request.requestHash != null)
              _row('Request id', '${request.requestHash!.substring(0, 12)}…'),
            if (request.canMoveFunds) ...[
              const SizedBox(height: 8),
              const Text(
                'Typed data and Permit-style signatures can approve spending without an immediate transfer. '
                'Reject if you did not expect an allowance request.',
                style: TextStyle(height: 1.4, color: Color(0xFFB54708)),
              ),
            ],
            const SizedBox(height: 8),
            const Text(
              'Never signs automatically. Preview signing — no live relay broadcast.',
              style: TextStyle(color: AetherColors.muted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () async {
                final ok = await authenticateConnectionsAction(
                  context,
                  wallet,
                  reason: 'Confirm before signing for ${request.appName}',
                );
                if (!ok || !context.mounted) return;
                await connections.approveSignature(request.id);
                if (context.mounted) Navigator.pop(context, true);
              },
              child: const Text('Approve signature'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () async {
                await connections.rejectSignature(request.id);
                if (context.mounted) Navigator.pop(context, false);
              },
              child: const Text('Reject'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AetherColors.muted, fontSize: 12)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(height: 1.4, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
