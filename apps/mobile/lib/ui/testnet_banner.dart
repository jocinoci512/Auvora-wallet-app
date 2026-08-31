import 'package:flutter/material.dart';

import '../release/auvora_qa_local_evm.dart';
import '../release/auvora_qa_local_solana.dart';
import '../release/network_env.dart';
import '../release/release_config.dart';
import '../theme/aether_theme.dart';

/// Persistent professional indicator for QA / testnet builds.
class TestnetBanner extends StatelessWidget {
  const TestnetBanner({super.key});

  @override
  Widget build(BuildContext context) {
    if (!AuvoraNetworkEnv.isTestnet) return const SizedBox.shrink();
    final localEvm = AuvoraQaLocalEvm.isActive;
    final localSol = AuvoraQaLocalSolana.isActive;
    final chip = (localEvm || localSol)
        ? (localEvm ? AuvoraQaLocalEvm.bannerLabel : AuvoraQaLocalSolana.bannerLabel)
        : 'TESTNET';
    final String broadcast;
    if (localEvm && localSol) {
      broadcast = ReleaseConfig.canBroadcastTestnet
          ? 'Local EVM + Solana QA · broadcast ON · mainnet OFF'
          : 'Local EVM + Solana QA · mainnet OFF';
    } else if (localEvm) {
      broadcast = ReleaseConfig.canBroadcastTestnet
          ? 'Auvora Local EVM QA · broadcast ON · mainnet OFF'
          : 'Auvora Local EVM QA · mainnet OFF';
    } else if (localSol) {
      broadcast = ReleaseConfig.canBroadcastTestnet
          ? 'Auvora Local Solana QA · broadcast ON · mainnet OFF'
          : 'Auvora Local Solana QA · mainnet OFF';
    } else {
      broadcast = ReleaseConfig.canBroadcastTestnet
          ? 'TESTNET broadcast ON · mainnet OFF'
          : 'TESTNET mode · mainnet broadcast OFF';
    }
    return Material(
      color: const Color(0xFF1A3A4A),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AetherColors.lagoon,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                chip,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                  letterSpacing: 0.6,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                broadcast,
                style: const TextStyle(color: Colors.white, fontSize: 12, height: 1.25),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
