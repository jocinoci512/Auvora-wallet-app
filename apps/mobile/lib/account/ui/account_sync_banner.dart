import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../theme/aether_theme.dart';
import '../wallet_backend_sync.dart';

/// Subtle transport warning when account metadata could not reach the cloud.
/// Never implies the customer must "link" a wallet that already exists on-device.
class AccountSyncBanner extends StatelessWidget {
  const AccountSyncBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final sync = Provider.of<WalletBackendSync?>(context, listen: true);
    if (sync == null || !sync.needsSyncWarning) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Text(
        sync.lastError ?? 'Account details will update when the connection is stable.',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AetherColors.mutedFor(context),
            ),
      ),
    );
  }
}
