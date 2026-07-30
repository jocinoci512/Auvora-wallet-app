import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../portfolio/models.dart';
import '../portfolio/portfolio_controller.dart';
import '../release/release_config.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import '../transfer/address_validation.dart';
import 'home/home_shared.dart';

class ReceiveFlowScreen extends StatefulWidget {
  const ReceiveFlowScreen({super.key, this.initialAssetId});

  final String? initialAssetId;

  @override
  State<ReceiveFlowScreen> createState() => _ReceiveFlowScreenState();
}

class _ReceiveFlowScreenState extends State<ReceiveFlowScreen> {
  AssetNetwork _network = AssetNetwork.ethereum;
  String? _assetId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<PortfolioController>();
      if (widget.initialAssetId != null) {
        final a = p.assetById(widget.initialAssetId!);
        if (a != null) {
          setState(() {
            _assetId = a.id;
            _network = AddressValidation.canReceiveOnDevice(a.network) ? a.network : AssetNetwork.ethereum;
          });
          return;
        }
      }
      final first = p.snapshot?.assets
          .where((a) => AddressValidation.canReceiveOnDevice(a.network))
          .toList();
      if (first != null && first.isNotEmpty) {
        setState(() {
          _assetId = first.first.id;
          _network = first.first.network;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletController>();
    final portfolio = context.watch<PortfolioController>();
    final address = wallet.addressFor(_network) ?? '';
    final assets = portfolio.snapshot?.assets ?? const <AssetHolding>[];
    final safe = AddressValidation.canReceiveOnDevice(_network);
    AssetHolding? asset = portfolio.assetById(_assetId ?? '');
    if (asset == null) {
      for (final a in assets) {
        if (a.network == _network) {
          asset = a;
          break;
        }
      }
    }
    final wide = MediaQuery.sizeOf(context).width >= 900;

    return Scaffold(
      appBar: AppBar(title: const Text('Receive')),
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: wide ? 520 : double.infinity),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                Text('Show this to the sender', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 6),
                Text(
                  'Match the network exactly. A wrong network can permanently lose funds.',
                  style: TextStyle(color: AetherColors.mutedFor(context), height: 1.4),
                ),
                const SizedBox(height: 12),
                const SoftBanner(
                  tone: BannerTone.warn,
                  message: ReleaseConfig.fundingBlockedMessage,
                ),
                const SizedBox(height: 18),
                Text('Network', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final n in wallet.availableNetworks)
                      ChoiceChip(
                        label: Text(n.label),
                        selected: _network == n,
                        onSelected: (_) {
                          setState(() {
                            _network = n;
                            for (final a in assets) {
                              if (a.network == n) {
                                _assetId = a.id;
                                break;
                              }
                            }
                          });
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                if (!ReleaseConfig.allowFundingAddresses) ...[
                  SoftBanner(
                    tone: BannerTone.error,
                    message:
                        'Receive is locked for real funding in ${ReleaseConfig.buildLabel}. You can still explore networks and practice other journeys.',
                  ),
                ] else if (!safe) ...[
                  SoftBanner(
                    tone: BannerTone.error,
                    message:
                        '${_network.label} deposit addresses aren’t ready on this device yet. Wait for full network sync before receiving here.',
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'We never show a QR for the wrong network. That keeps your funds safe.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AetherColors.muted, height: 1.45),
                  ),
                ] else ...[
                  if (assets.any((a) => a.network == _network || AddressValidation.isEvm(a.network))) ...[
                    Text('Asset', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: asset?.id,
                      items: [
                        for (final a in assets.where((x) => x.network == _network))
                          DropdownMenuItem(value: a.id, child: Text('${a.name} (${a.ticker})')),
                      ],
                      onChanged: (id) {
                        if (id == null) return;
                        final a = portfolio.assetById(id);
                        setState(() {
                          _assetId = id;
                          if (a != null) _network = a.network;
                        });
                      },
                    ),
                  ],
                  const SizedBox(height: 20),
                  if (address.isEmpty) ...[
                    SoftBanner(
                      tone: BannerTone.error,
                      message:
                          'No ${_network.label} address is ready yet. Finish wallet setup, then try again.',
                    ),
                  ] else ...[
                  Center(
                    child: Semantics(
                      label: 'Receiving QR code for ${_network.label}',
                      child: Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AetherColors.border),
                        ),
                        child: QrImageView(
                          data: address,
                          size: wide ? 280 : 240,
                          backgroundColor: Colors.white,
                          eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: AetherColors.ink),
                          dataModuleStyle: const QrDataModuleStyle(
                            dataModuleShape: QrDataModuleShape.square,
                            color: AetherColors.ink,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(_network.label, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (asset != null)
                    Text(asset.ticker, textAlign: TextAlign.center, style: TextStyle(color: AetherColors.mutedFor(context))),
                  const SizedBox(height: 12),
                  SelectableText(
                    address,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, height: 1.4, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 14),
                  SoftBanner(
                    tone: BannerTone.warn,
                    message:
                        'Only send ${_network.label}-compatible assets here. Never send Bitcoin or Solana to this address.',
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () async {
                            await Clipboard.setData(ClipboardData(text: address));
                            HapticFeedback.selectionClick();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Address copied')),
                              );
                            }
                          },
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Copy address'),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: () => Share.share(
                              'My Auvora ${_network.label} address:\n$address',
                              subject: 'Auvora receive address',
                            ),
                    icon: const Icon(Icons.ios_share_rounded),
                    label: const Text('Share address'),
                  ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
