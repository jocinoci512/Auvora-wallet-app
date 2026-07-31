import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../connections/connections_controller.dart';
import '../../connections/models.dart';
import '../../connections/permission_catalog.dart';
import '../../connections/signature_intelligence.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import 'connections_auth.dart';

Future<bool?> showDappTransactionRequestSheet(
  BuildContext context, {
  required DappTransactionRequest request,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _TxBody(request: request),
  );
}

class _TxBody extends StatelessWidget {
  const _TxBody({required this.request});
  final DappTransactionRequest request;

  @override
  Widget build(BuildContext context) {
    final connections = context.read<ConnectionsController>();
    final wallet = context.read<WalletController>();
    final amountLabel = '${request.amount} ${request.assetSymbol}';
    final intel = SignatureIntelligence.forTransaction(request);

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      minChildSize: 0.45,
      maxChildSize: 0.95,
      builder: (context, controller) {
        return ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Text('Transaction request', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(request.appName, style: Theme.of(context).textTheme.titleMedium),
            Text(request.origin, style: const TextStyle(color: AetherColors.muted)),
            const SizedBox(height: 14),
            Text(intel.headline, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35)),
            const SizedBox(height: 8),
            for (final bullet in intel.bullets)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text('• $bullet', style: const TextStyle(height: 1.4)),
              ),
            const SizedBox(height: 14),
            _row('Recipient', request.recipient),
            _row('Wallet', 'Primary account'),
            _row('Network', request.network),
            _row('Amount', amountLabel),
            _row('Network fee', request.feeEstimate),
            _row('Purpose', request.purpose),
            _row('Simulation', request.simulationNote),
            _row('Risk', riskLabel(request.risk)),
            const SizedBox(height: 8),
            Text('Warnings', style: Theme.of(context).textTheme.titleSmall),
            for (final warning in request.warnings)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('• $warning', style: const TextStyle(height: 1.4)),
              ),
            const SizedBox(height: 12),
            const Text(
              'Never signs automatically. Preview simulation — not live chain state. Approving records activity only and will not broadcast.',
              style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () async {
                final ok = await authenticateConnectionsAction(
                  context,
                  wallet,
                  reason: 'Confirm before approving this transaction request',
                );
                if (!ok || !context.mounted) return;
                await connections.approveTransaction(request.id);
                if (context.mounted) Navigator.pop(context, true);
              },
              child: const Text('Approve (preview — won’t broadcast)'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () async {
                await connections.rejectTransaction(request.id);
                if (context.mounted) Navigator.pop(context, false);
              },
              child: const Text('Reject'),
            ),
          ],
        );
      },
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label, style: const TextStyle(color: AetherColors.muted))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600, height: 1.35))),
        ],
      ),
    );
  }
}
