import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../portfolio/models.dart';
import '../portfolio/portfolio_controller.dart';
import '../intelligence/intelligence_controller.dart';
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
      context.read<IntelligenceController>().noteEvent('onReceive');
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

  String _qrPayload(String address) {
    return buildPaymentUri(network: _network, address: address);
  }

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletController>();
    final portfolio = context.watch<PortfolioController>();
    final address = wallet.addressFor(_network) ?? '';
    final assets = portfolio.snapshot?.assets ?? const <AssetHolding>[];
    final safe = AddressValidation.canReceiveOnDevice(_network);
    final fundingUnlocked = ReleaseConfig.allowFundingAddresses;
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
    final walletLabel = wallet.wallet?.name ?? 'Primary wallet';
    final qrData = address.isEmpty ? '' : _qrPayload(address);

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
                Text(
                  fundingUnlocked ? 'Show this to the sender' : 'Receive (locked)',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  fundingUnlocked
                      ? 'Match the network exactly. A wrong network can permanently lose funds.'
                      : 'Funding is locked for ${ReleaseConfig.buildLabel}. Addresses exist for derivation preview, but QR, copy, and share stay off.',
                  style: TextStyle(color: AetherColors.mutedFor(context), height: 1.4),
                ),
                const SizedBox(height: 12),
                SoftBanner(
                  tone: fundingUnlocked ? BannerTone.warn : BannerTone.error,
                  message: fundingUnlocked
                      ? 'You’re receiving on ${_network.label}. Confirm the sender uses the same network.'
                      : ReleaseConfig.fundingBlockedMessage,
                ),
                if (wallet.vaults.length > 1) ...[
                  const SizedBox(height: 12),
                  _kv(context, 'Wallet', walletLabel),
                ],
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
                        materialTapTargetSize: MaterialTapTargetSize.padded,
                        visualDensity: VisualDensity.comfortable,
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
                if (!fundingUnlocked) ...[
                  const SoftBanner(
                    tone: BannerTone.warn,
                    message:
                        'BIP32 / SLIP-0010 derivation is active. Off-device address verification is still required before funding unlocks.',
                  ),
                  const SizedBox(height: 16),
                  Semantics(
                    label: 'Receive funding locked. QR code and copy actions are disabled.',
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
                      decoration: BoxDecoration(
                        color: AetherColors.danger.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AetherColors.danger.withValues(alpha: 0.35)),
                      ),
                      child: Column(
                        children: [
                          Icon(Icons.lock_outline_rounded, size: 40, color: AetherColors.danger.withValues(alpha: 0.9)),
                          const SizedBox(height: 12),
                          const Text(
                            'Funding QR disabled',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Copy and share stay off so testers cannot accidentally fund Alpha addresses.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AetherColors.mutedFor(context), height: 1.4),
                          ),
                          if (address.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text(
                              'Derivation preview (${_network.label})',
                              style: TextStyle(
                                color: AetherColors.mutedFor(context),
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 6),
                            SelectableText(
                              ReleaseConfig.redactAddress(address),
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13, height: 1.4, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: null,
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Copy address (locked)'),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: null,
                    icon: const Icon(Icons.ios_share_rounded),
                    label: const Text('Share address (locked)'),
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
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AetherColors.mutedFor(context),
                          height: 1.45,
                        ),
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
                            data: qrData,
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
                    Text(
                      _network.label,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    if (asset != null)
                      Text(
                        asset.ticker,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AetherColors.mutedFor(context)),
                      ),
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
                          'Only send ${_network.label}-compatible assets here. Sending on the wrong network can permanently lose funds.',
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: () => copyText(context, address, label: 'Address copied'),
                      icon: const Icon(Icons.copy_rounded),
                      label: const Text('Copy address'),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () => Share.share(
                        'My Auvora ${_network.label} address ($walletLabel):\n$address',
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

  Widget _kv(BuildContext context, String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Text('$k: ', style: TextStyle(color: AetherColors.mutedFor(context))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
