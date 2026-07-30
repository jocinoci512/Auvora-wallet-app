import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../intelligence/catalog.dart';
import '../intelligence/intelligence_controller.dart';
import '../intelligence/models.dart';
import '../portfolio/models.dart';
import '../portfolio/portfolio_controller.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import '../transfer/address_book.dart';
import '../transfer/address_validation.dart';
import '../wallet_engine/network_manager.dart';
import '../wallet_engine/transaction_engine.dart';
import 'home/home_shared.dart';
import 'intelligence/intelligence_tip.dart';
import 'intelligence/learning_center_screen.dart';
import 'qr_scanner_screen.dart';
import 'transaction_detail_screen.dart';
import 'widgets/passcode_entry.dart';

enum _SendStep { asset, recipient, amount, review, auth, done }

/// Guided send — asset → recipient → amount → checklist → auth → receipt.
class SendFlowScreen extends StatefulWidget {
  const SendFlowScreen({super.key, this.initialAssetId});

  final String? initialAssetId;

  @override
  State<SendFlowScreen> createState() => _SendFlowScreenState();
}

class _SendFlowScreenState extends State<SendFlowScreen> {
  _SendStep _step = _SendStep.asset;
  AssetHolding? _asset;
  bool _fiatMode = false;
  String _assetQuery = '';
  bool _hideUnsupported = true;
  final Set<String> _checks = {};
  bool _submitting = false;
  String? _pinError;
  PortfolioTx? _result;
  bool _doubleTapGuard = false;
  bool _offline = false;
  String? _addrWarning;

  final _toCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();

  AddressBookStore get _book => context.read<AddressBookStore>();
  PortfolioController get _portfolio => context.read<PortfolioController>();
  WalletController get _wallet => context.read<WalletController>();

  bool get _hasDraft =>
      _asset != null || _toCtrl.text.trim().isNotEmpty || _amountCtrl.text.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _toCtrl.addListener(() => setState(() {}));
    _amountCtrl.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      _book.load();
      await _checkConnectivity();
      if (widget.initialAssetId != null) {
        final a = _portfolio.assetById(widget.initialAssetId!);
        if (a != null && a.balance > 0) {
          setState(() {
            _asset = a;
            _step = _SendStep.recipient;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _toCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkConnectivity() async {
    if (kIsWeb) {
      setState(() => _offline = false);
      return;
    }
    final network = context.read<NetworkManager>();
    await network.refresh();
    if (mounted) setState(() => _offline = network.offline);
  }

  void _setTo(String raw) {
    final parsed = AddressValidation.parsePaymentUri(raw);
    _toCtrl.text = parsed.address;
    _toCtrl.selection = TextSelection.collapsed(offset: _toCtrl.text.length);
    if (parsed.embeddedAmount != null && parsed.embeddedAmount! > 0) {
      _amountCtrl.text = parsed.embeddedAmount!.toStringAsFixed(6);
    }
    setState(() {});
  }

  Future<bool> _confirmDiscard() async {
    if (_step == _SendStep.done || !_hasDraft) return true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave this transfer?'),
        content: const Text('Your progress on this send will be cleared.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep editing')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Leave')),
        ],
      ),
    );
    return ok == true;
  }

  void _go(_SendStep s) => setState(() => _step = s);

  int get _stepIndex => _SendStep.values.indexOf(_step).clamp(0, 5);

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final reduce = MediaQuery.disableAnimationsOf(context) || _wallet.reduceMotion;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final nav = Navigator.of(context);
        if (await _confirmDiscard() && mounted) nav.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_title),
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            tooltip: 'Close',
            onPressed: () async {
              final nav = Navigator.of(context);
              if (await _confirmDiscard() && mounted) nav.pop();
            },
          ),
        ),
        body: SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: wide ? 560 : double.infinity),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                    child: _StepDots(index: _stepIndex, total: 6, animate: !reduce),
                  ),
                  if (_offline)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
                      child: SoftBanner(
                        tone: BannerTone.warn,
                        message: 'You appear offline. You can still prepare a transfer; submission waits until you’re back online.',
                      ),
                    ),
                  Expanded(child: _body()),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String get _title {
    switch (_step) {
      case _SendStep.asset:
        return 'Send';
      case _SendStep.recipient:
        return 'Recipient';
      case _SendStep.amount:
        return 'Amount';
      case _SendStep.review:
        return 'Review';
      case _SendStep.auth:
        return 'Confirm';
      case _SendStep.done:
        return 'Submitted';
    }
  }

  Widget _body() {
    switch (_step) {
      case _SendStep.asset:
        return _assetStep();
      case _SendStep.recipient:
        return _recipientStep();
      case _SendStep.amount:
        return _amountStep();
      case _SendStep.review:
        return _reviewStep();
      case _SendStep.auth:
        return _authStep();
      case _SendStep.done:
        return _doneStep();
    }
  }

  Widget _assetStep() {
    final p = context.watch<PortfolioController>();
    var assets = [...(p.snapshot?.assets ?? const <AssetHolding>[])];
    if (_hideUnsupported) assets = assets.where((a) => a.balance > 0).toList();
    final q = _assetQuery.trim().toLowerCase();
    if (q.isNotEmpty) {
      assets = assets
          .where((a) => a.name.toLowerCase().contains(q) || a.ticker.toLowerCase().contains(q))
          .toList();
    }
    assets.sort((a, b) {
      final af = p.favorites.contains(a.id) ? 0 : 1;
      final bf = p.favorites.contains(b.id) ? 0 : 1;
      if (af != bf) return af.compareTo(bf);
      return b.fiatValue.compareTo(a.fiatValue);
    });

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      children: [
        const Text(
          'Choose what to send. Only assets with a balance can move.',
          style: TextStyle(color: AetherColors.muted, height: 1.4),
        ),
        const SizedBox(height: 12),
        TextField(
          onChanged: (v) => setState(() => _assetQuery = v),
          decoration: const InputDecoration(
            hintText: 'Search assets',
            prefixIcon: Icon(Icons.search_rounded),
          ),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Hide empty balances'),
          value: _hideUnsupported,
          onChanged: (v) => setState(() => _hideUnsupported = v),
        ),
        if (assets.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Text(
              'Nothing available to send yet. Receive funds first.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AetherColors.muted, height: 1.45),
            ),
          )
        else
          for (final a in assets)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: a.balance <= 0
                      ? null
                      : () {
                          setState(() {
                            _asset = a;
                            _checks.clear();
                            _addrWarning = null;
                          });
                          _go(_SendStep.recipient);
                        },
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        AssetAvatar(asset: a),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(a.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                              Text(
                                '${a.ticker} · ${a.network.label}',
                                style: const TextStyle(color: AetherColors.muted, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(p.crypto(a.balance, a.ticker), style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text(p.money(a.fiatValue), style: const TextStyle(color: AetherColors.muted, fontSize: 13)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
      ],
    );
  }

  Widget _recipientStep() {
    final asset = _asset!;
    final book = context.watch<AddressBookStore>();
    final validation = AddressValidation.validate(_toCtrl.text, expected: asset.network);
    final self = AddressValidation.looksLikeSameWallet(
      _toCtrl.text,
      _wallet.addressFor(_asset?.network ?? AssetNetwork.ethereum) ?? _wallet.address ?? '',
    );
    final contacts = book.forNetwork(asset.network);
    final recent = book.recentFor(asset.network);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      children: [
        Text('Sending ${asset.ticker} on ${asset.network.label}', style: const TextStyle(color: AetherColors.muted)),
        const SizedBox(height: 12),
        TextField(
          controller: _toCtrl,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: 'Paste ${asset.network.label} address',
            suffixIcon: IconButton(
              tooltip: 'Paste',
              onPressed: () async {
                final data = await Clipboard.getData(Clipboard.kTextPlain);
                if (data?.text != null) _setTo(data!.text!);
              },
              icon: const Icon(Icons.content_paste_rounded),
            ),
          ),
          autocorrect: false,
          enableSuggestions: false,
          keyboardType: TextInputType.visiblePassword,
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () async {
            final scanned = await Navigator.of(context).push<String>(
              MaterialPageRoute(builder: (_) => QrScannerScreen(expectedNetwork: asset.network)),
            );
            if (scanned != null && scanned.isNotEmpty) {
              _setTo(scanned);
              HapticFeedback.mediumImpact();
            }
          },
          icon: const Icon(Icons.qr_code_scanner_rounded),
          label: const Text('Scan QR'),
        ),
        if (_toCtrl.text.trim().isNotEmpty) ...[
          const SizedBox(height: 10),
          SoftBanner(
            tone: validation.ok
                ? (self ? BannerTone.warn : BannerTone.info)
                : BannerTone.error,
            message: validation.ok
                ? (self
                    ? 'This looks like your own address. You’ll need an extra confirmation on Review.'
                    : (validation.warning ?? 'Address looks valid for ${asset.network.label}.'))
                : (validation.message ?? 'Check the address.'),
          ),
        ],
        if (recent.isNotEmpty) ...[
          const SizedBox(height: 22),
          Text('Recent', style: Theme.of(context).textTheme.titleMedium),
          for (final c in recent)
            _ContactTile(contact: c, onTap: () => _setTo(c.address)),
        ],
        if (contacts.isNotEmpty) ...[
          const SizedBox(height: 18),
          Text('Address book', style: Theme.of(context).textTheme.titleMedium),
          for (final c in contacts)
            _ContactTile(contact: c, onTap: () => _setTo(c.address)),
        ],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: validation.ok
              ? () {
                  final n = validation.normalized ?? _toCtrl.text.trim();
                  _toCtrl.text = n;
                  _addrWarning = validation.warning;
                  _go(_SendStep.amount);
                }
              : null,
          child: const Text('Continue'),
        ),
        TextButton(onPressed: () => _go(_SendStep.asset), child: const Text('Change asset')),
      ],
    );
  }

  Widget _amountStep() {
    final asset = _asset!;
    final p = context.watch<PortfolioController>();
    final amount = _parsedAmount(asset);
    final fee = estimateFee(asset: asset, amount: amount);
    final feeInSame = fee.feeAsset == asset.ticker;
    final insufficient = feeInSame ? amount + fee.feeCrypto > asset.balance : amount > asset.balance;
    final large = asset.balance > 0 && amount / asset.balance >= 0.5;
    final remaining = (asset.balance - amount - (feeInSame ? fee.feeCrypto : 0)).clamp(0.0, asset.balance);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      children: [
        Text(
          'Available ${p.crypto(asset.balance, asset.ticker)} · ${p.money(asset.fiatValue)}',
          style: const TextStyle(color: AetherColors.muted),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _amountCtrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            labelText: _fiatMode ? 'Amount (USD)' : 'Amount (${asset.ticker})',
            suffixIcon: TextButton(
              onPressed: () {
                final amt = _parsedAmount(asset);
                setState(() {
                  _fiatMode = !_fiatMode;
                  _amountCtrl.text = _fiatMode
                      ? (amt * asset.priceUsd).toStringAsFixed(2)
                      : (amt == 0 ? '' : amt.toStringAsFixed(6));
                  _amountCtrl.selection = TextSelection.collapsed(offset: _amountCtrl.text.length);
                });
              },
              child: Text(_fiatMode ? asset.ticker : 'USD'),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          children: [
            for (final r in [0.25, 0.5, 0.75, 1.0])
              ActionChip(
                label: Text(r == 1 ? 'MAX' : '${(r * 100).toInt()}%'),
                onPressed: () {
                  var value = asset.balance * r;
                  if (r == 1.0 && feeInSame) {
                    value = (asset.balance - fee.feeCrypto).clamp(0.0, asset.balance);
                  }
                  setState(() {
                    _fiatMode = false;
                    _amountCtrl.text = value.toStringAsFixed(6);
                  });
                },
              ),
          ],
        ),
        const SizedBox(height: 16),
        _kv('Estimated network fee', '${fee.feeCrypto} ${fee.feeAsset} · ${p.money(fee.feeUsd)}'),
        if (!feeInSame)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              'Fee is paid in ${fee.feeAsset}, separate from the ${asset.ticker} you send.',
              style: const TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
            ),
          ),
        _kv('Recipient receives', amount <= 0 ? '—' : '${amount.toStringAsFixed(6)} ${asset.ticker}'),
        _kv('You’ll have left', p.crypto(remaining, asset.ticker)),
        _kv('Estimated arrival', fee.arrivalLabel),
        if (context.watch<IntelligenceController>().shouldShowExplanation(IntelligenceKind.transaction)) ...[
          const SizedBox(height: 12),
          if (fee.feeUsd >= 8)
            IntelligenceExplainPanel(
              explanation: IntelligenceCatalog.explainFeeEstimate(
                networkLabel: asset.network.label,
                elevated: true,
              ),
              onLearnMore: () => openLesson(context, 'gas-fees'),
            )
          else
            const Text(
              'Network fee estimate — pays the network to include your transfer. Timing is never guaranteed.',
              style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
            ),
        ],
        if (insufficient) ...[
          const SizedBox(height: 10),
          SoftBanner(
            tone: BannerTone.error,
            message: feeInSame
                ? 'Amount plus network fee is more than your available balance.'
                : 'That amount is more than your available balance.',
          ),
        ],
        if (large && !insufficient) ...[
          const SizedBox(height: 10),
          const SoftBanner(
            tone: BannerTone.warn,
            message: 'This is half or more of your balance. Pause and confirm the recipient.',
          ),
        ],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: amount > 0 && !insufficient
              ? () {
                  setState(() => _checks.clear());
                  _go(_SendStep.review);
                }
              : null,
          child: const Text('Review transfer'),
        ),
        TextButton(onPressed: () => _go(_SendStep.recipient), child: const Text('Back')),
      ],
    );
  }

  double _parsedAmount(AssetHolding asset) {
    final n = double.tryParse(_amountCtrl.text.replaceAll(',', '')) ?? 0;
    if (_fiatMode) {
      if (asset.priceUsd <= 0) return 0;
      return n / asset.priceUsd;
    }
    return n;
  }

  Widget _reviewStep() {
    final asset = _asset!;
    final p = context.watch<PortfolioController>();
    final amount = _parsedAmount(asset);
    final fee = estimateFee(asset: asset, amount: amount);
    final to = _toCtrl.text.trim();
    final self = AddressValidation.looksLikeSameWallet(
      to,
      _wallet.addressFor(asset.network) ?? _wallet.address ?? '',
    );
    final short = to.length > 10 ? '…${to.substring(to.length - 6)}' : to;

    final items = <(String, String)>[
      ('recipient', 'I checked the full recipient address (ends $short)'),
      ('network', 'I confirmed this is ${asset.network.label}'),
      ('amount', 'I confirmed ${amount.toStringAsFixed(6)} ${asset.ticker} is correct'),
      if (self) ('self', 'I intentionally want to send to my own address'),
    ];
    final allChecked = items.every((e) => _checks.contains(e.$1));

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      children: [
        const Text(
          'Crypto transfers cannot be reversed. Verify every line.',
          style: TextStyle(color: AetherColors.muted, height: 1.45),
        ),
        const SizedBox(height: 16),
        _kv('Asset', '${asset.name} (${asset.ticker})'),
        _kv('Network', asset.network.label),
        const Text('To', style: TextStyle(color: AetherColors.muted)),
        const SizedBox(height: 4),
        SelectableText(to, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, height: 1.4)),
        const SizedBox(height: 10),
        _kv('Amount', '${amount.toStringAsFixed(6)} ${asset.ticker} · ${p.money(amount * asset.priceUsd)}'),
        _kv('Estimated fee', '${fee.feeCrypto} ${fee.feeAsset} · ${p.money(fee.feeUsd)}'),
        _kv('Estimated arrival', fee.arrivalLabel),
        if (_addrWarning != null) ...[
          const SizedBox(height: 10),
          SoftBanner(message: _addrWarning!),
        ],
        if (self) ...[
          const SizedBox(height: 10),
          const SoftBanner(tone: BannerTone.warn, message: 'Sending to yourself.'),
        ],
        const SizedBox(height: 18),
        Text('Before you continue', style: Theme.of(context).textTheme.titleMedium),
        for (final item in items)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: _checks.contains(item.$1),
            onChanged: (v) {
              setState(() {
                if (v == true) {
                  _checks.add(item.$1);
                } else {
                  _checks.remove(item.$1);
                }
              });
            },
            title: Text(item.$2),
            controlAffinity: ListTileControlAffinity.leading,
          ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: allChecked && _wallet.hasPin
              ? () async {
                  await _checkConnectivity();
                  if (_offline && mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('You’re offline. Reconnect to submit this transfer securely.'),
                      ),
                    );
                    return;
                  }
                  _go(_SendStep.auth);
                  if (_wallet.biometricsEnabled) {
                    final ok = await _wallet.authenticateForTransfer(
                      reason: 'Confirm sending ${amount.toStringAsFixed(4)} ${asset.ticker}',
                    );
                    if (ok && mounted) await _submit();
                  }
                }
              : null,
          child: const Text('Authenticate to send'),
        ),
        if (!_wallet.hasPin)
          const SoftBanner(
            tone: BannerTone.error,
            message: 'A passcode is required before any transfer. Set one up from security settings.',
          ),
        TextButton(onPressed: () => _go(_SendStep.amount), child: const Text('Back')),
      ],
    );
  }

  Widget _authStep() {
    if (_submitting) {
      return const Center(child: CircularProgressIndicator());
    }
    final asset = _asset!;
    final amount = _parsedAmount(asset);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      children: [
        Text(
          'Authorize ${amount.toStringAsFixed(6)} ${asset.ticker}',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        const Text(
          'Biometrics or your passcode prove it’s you — never share either.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AetherColors.muted, height: 1.45),
        ),
        const SizedBox(height: 16),
        if (_wallet.biometricsEnabled)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: OutlinedButton.icon(
              onPressed: () async {
                final ok = await _wallet.authenticateForTransfer(
                  reason: 'Confirm sending ${amount.toStringAsFixed(4)} ${asset.ticker}',
                );
                if (ok) await _submit();
              },
              icon: const Icon(Icons.fingerprint),
              label: const Text('Use biometrics'),
            ),
          ),
        PasscodeEntry(
          errorText: _pinError,
          enabled: !_submitting,
          onCompleted: (pin) async {
            final ok = await _wallet.verifyPin(pin);
            if (!ok) {
              setState(() => _pinError = 'Incorrect passcode. Try again.');
              return;
            }
            await _submit();
          },
        ),
        TextButton(onPressed: () => _go(_SendStep.review), child: const Text('Back')),
      ],
    );
  }

  Future<void> _submit() async {
    if (_doubleTapGuard || _submitting) return;
    final engine = context.read<TransactionEngine>();
    await _checkConnectivity();
    if (_offline) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('You’re offline. Reconnect, then try again.')),
        );
      }
      return;
    }
    _doubleTapGuard = true;
    setState(() {
      _submitting = true;
      _pinError = null;
    });
    try {
      final asset = _asset!;
      final amount = _parsedAmount(asset);
      final result = await engine.submitSend(
        asset: asset,
        to: _toCtrl.text.trim(),
        amount: amount,
        memo: 'Sent from Auvora',
      );
      final tx = result.tx;
      final snap = _portfolio.snapshot;
      if (snap != null) {
        final assets = snap.assets.map((item) {
          if (item.id != asset.id) return item;
          return item.copyWith(balance: (item.balance - amount).clamp(0, double.infinity).toDouble());
        }).toList();
        _portfolio.applyLocalSnapshot(assets: assets, prependTx: tx);
      }
      await _book.rememberRecipient(address: _toCtrl.text.trim(), network: asset.network);
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      setState(() {
        _result = tx;
        _submitting = false;
        _step = _SendStep.done;
      });
      if (mounted) {
        context.read<IntelligenceController>().noteEvent('afterFirstTx');
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _doubleTapGuard = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Something went wrong. Nothing was sent — try again.')),
      );
    }
  }

  Widget _doneStep() {
    final tx = _result!;
    final asset = _asset!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        const Icon(Icons.check_circle_outline_rounded, size: 48, color: Color(0xFF067647)),
        const SizedBox(height: 12),
        Text('Your transfer has been securely submitted', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
          'Status: ${tx.status.label}. We’ll update this as confirmation arrives.',
          style: const TextStyle(color: AetherColors.muted, height: 1.45),
        ),
        const SizedBox(height: 16),
        _kv('Amount', '${tx.amount} ${asset.ticker}'),
        _kv('To', tx.to),
        _kv('Network', asset.network.label),
        const Text('Reference', style: TextStyle(color: AetherColors.muted)),
        const SizedBox(height: 4),
        SelectableText(tx.hash, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        const SoftBanner(
          message:
              'This device recorded the transfer in Activity. We’ll update status as confirmation arrives.',
        ),
        if (context.watch<IntelligenceController>().pendingTip case final tip?) ...[
          const SizedBox(height: 12),
          IntelligenceTipCard(
            title: tip.title,
            body: tip.body,
            onDismiss: () => context.read<IntelligenceController>().dismissTip(tip.id),
            onLearnMore: tip.learnTopicId == null
                ? null
                : () => openLesson(context, tip.learnTopicId),
          ),
        ],
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () => copyText(context, tx.hash, label: 'Reference copied'),
          icon: const Icon(Icons.copy_rounded),
          label: const Text('Copy reference'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => Share.share(
            'Auvora transfer\n${tx.amount} ${asset.ticker}\nTo: ${tx.to}\nRef: ${tx.hash}',
            subject: 'Auvora transfer',
          ),
          icon: const Icon(Icons.ios_share_rounded),
          label: const Text('Share receipt'),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: () {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute<void>(builder: (_) => TransactionDetailScreen(txId: tx.id)),
            );
          },
          child: const Text('View transaction'),
        ),
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Return home')),
      ],
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 120, child: Text(k, style: const TextStyle(color: AetherColors.muted))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

class _StepDots extends StatelessWidget {
  const _StepDots({required this.index, required this.total, this.animate = true});

  final int index;
  final int total;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Step ${index + 1} of $total',
      child: Row(
        children: [
          for (var i = 0; i < total; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: AnimatedContainer(
                duration: animate ? const Duration(milliseconds: 200) : Duration.zero,
                height: 4,
                decoration: BoxDecoration(
                  color: i <= index ? AetherColors.lagoon : AetherColors.border,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({required this.contact, required this.onTap});

  final SavedContact contact;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      leading: CircleAvatar(
        backgroundColor: AetherColors.lagoon.withValues(alpha: 0.12),
        child: Text(contact.initials, style: const TextStyle(color: AetherColors.lagoon, fontWeight: FontWeight.w700)),
      ),
      title: Text(contact.name, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text('${contact.preview} · ${contact.network.label}'),
      trailing: contact.favorite ? const Icon(Icons.star_rounded, color: AetherColors.lagoon, size: 18) : null,
    );
  }
}
