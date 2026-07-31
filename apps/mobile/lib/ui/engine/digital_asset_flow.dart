import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../engine/engine_controller.dart';
import '../../engine/models.dart';
import '../../engine/quote_engine.dart';
import '../../engine/quote_provider_port.dart';
import '../../intelligence/intelligence_controller.dart';
import '../../portfolio/models.dart';
import '../../portfolio/portfolio_controller.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../../wallet_engine/network_manager.dart';
import '../../wallet_engine/transaction_engine.dart';
import '../home/home_shared.dart';
import '../intelligence/intelligence_tip.dart';
import 'engine_shared.dart';

enum _Phase { configure, review, progress, done }

enum _StakeAction { stake, unstake, claim }

/// Unified Buy / Sell / Swap / Bridge / Stake experience.
class DigitalAssetFlowScreen extends StatefulWidget {
  const DigitalAssetFlowScreen({super.key, required this.op, this.initialFrom});

  final EngineOp op;
  final String? initialFrom;

  @override
  State<DigitalAssetFlowScreen> createState() => _DigitalAssetFlowScreenState();
}

class _DigitalAssetFlowScreenState extends State<DigitalAssetFlowScreen> {
  _Phase _phase = _Phase.configure;
  final _amountCtrl = TextEditingController(text: '100');
  late final EngineController _engine;
  bool _engineReady = false;

  String _from = 'ETH';
  String _to = 'USDC';
  AssetNetwork _network = AssetNetwork.ethereum;
  AssetNetwork _destNetwork = AssetNetwork.polygon;
  PaymentMethod _pay = PaymentMethod.card;
  String _buyProvider = 'auvora-sim';
  List<BuyProviderOffer> _buyOffers = const [];
  String _sellDestination = 'bank';
  StakePool _pool = QuoteEngine.stakePools.first;
  _StakeAction _stakeAction = _StakeAction.stake;
  int _slippageBps = 50;
  AssetQuote? _quote;
  AssetQuote? _prevQuote;
  EngineReceipt? _receipt;
  EngineStatus _liveStatus = EngineStatus.preparing;
  bool _quoting = false;
  bool _checkedFees = false;
  bool _checkedDetails = false;
  bool _checkedIrreversible = false;
  bool _offline = false;
  bool _priceMoved = false;
  Timer? _autoRefresh;
  Timer? _debounce;
  String? _error;

  bool get _dirty => _phase != _Phase.done && (_quote != null || _amountCtrl.text.isNotEmpty);

  @override
  void initState() {
    super.initState();
    if (widget.initialFrom != null) _from = widget.initialFrom!;
    if (widget.op == EngineOp.buy) {
      _to = widget.initialFrom ?? 'ETH';
      _amountCtrl.text = '100';
    } else if (widget.op == EngineOp.sell) {
      _from = widget.initialFrom ?? 'ETH';
      _amountCtrl.text = '0.1';
    } else if (widget.op == EngineOp.swap) {
      _from = widget.initialFrom ?? 'ETH';
      _to = 'USDC';
      _amountCtrl.text = '0.25';
    } else if (widget.op == EngineOp.bridge) {
      _from = widget.initialFrom ?? 'USDC';
      _amountCtrl.text = '50';
    } else {
      _pool = QuoteEngine.stakePools.first;
      _from = _pool.asset;
      _network = _pool.network;
      _amountCtrl.text = _pool.minStake.toString();
    }
    _amountCtrl.addListener(_onAmountChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _engine.loadHistory();
      _checkConnectivity();
      _refreshQuote();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_engineReady) return;
    _engine = EngineController(transactionEngine: context.read<TransactionEngine>());
    _engineReady = true;
  }

  @override
  void dispose() {
    _autoRefresh?.cancel();
    _debounce?.cancel();
    _amountCtrl.removeListener(_onAmountChanged);
    _amountCtrl.dispose();
    _engine.dispose();
    super.dispose();
  }

  void _onAmountChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () {
      if (mounted && _phase == _Phase.configure) _refreshQuote();
    });
  }

  Future<void> _checkConnectivity() async {
    final network = context.read<NetworkManager>();
    await network.refresh();
    if (mounted) setState(() => _offline = network.offline);
  }

  List<AssetHolding> get _assets =>
      context.read<PortfolioController>().snapshot?.assets ?? const [];

  AssetHolding? _holding(String ticker) {
    for (final a in _assets) {
      if (a.ticker == ticker) return a;
    }
    return null;
  }

  double _price(String ticker) => _holding(ticker)?.priceUsd ?? (ticker == 'USDC' ? 1 : 100);

  double get _spendTickerBalance {
    if (widget.op == EngineOp.buy) return double.infinity;
    final t = widget.op == EngineOp.stake ? _pool.asset : _from;
    return _holding(t)?.balance ?? 0;
  }

  bool get _insufficient {
    if (widget.op == EngineOp.buy) return false;
    if (_stakeAction == _StakeAction.claim) return false;
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', '')) ?? 0;
    return amount > _spendTickerBalance + 1e-12;
  }

  bool get _largeNotional {
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', '')) ?? 0;
    if (widget.op == EngineOp.buy) return amount >= 1000;
    final usd = amount * _price(widget.op == EngineOp.stake ? _pool.asset : _from);
    final bal = _spendTickerBalance;
    return usd >= 1000 || (bal > 0 && amount >= bal * 0.5);
  }

  Future<bool> _confirmDiscard() async {
    if (!_dirty || _phase == _Phase.done || _phase == _Phase.progress) return true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Leave this ${widget.op.label.toLowerCase()}?'),
        content: const Text('Your quote and checklist will be cleared.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep editing')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Leave')),
        ],
      ),
    );
    return ok == true;
  }

  void _armAutoRefresh() {
    _autoRefresh?.cancel();
    if (_quote == null || widget.op == EngineOp.stake) return;
    _autoRefresh = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _quote == null) return;
      if (_quote!.secondsRemaining == 0 && (_phase == _Phase.configure || _phase == _Phase.review)) {
        _refreshQuote();
      } else {
        setState(() {});
      }
    });
  }

  Future<void> _refreshQuote() async {
    setState(() {
      _quoting = true;
      _error = null;
      _checkedFees = false;
      _checkedDetails = false;
      _checkedIrreversible = false;
    });
    try {
      final amount = double.tryParse(_amountCtrl.text.replaceAll(',', '')) ?? 0;
      final q = await _engine.refresh(() async {
        switch (widget.op) {
          case EngineOp.buy:
            final offers = await _engine.quotes.compareBuyProviders(
              asset: _to,
              network: _holding(_to)?.network ?? _network,
              fiatUsd: amount,
              method: _pay,
              assetPriceUsd: _price(_to),
            );
            if (mounted) setState(() => _buyOffers = offers);
            return _engine.quotes.quoteBuy(
              asset: _to,
              network: _holding(_to)?.network ?? _network,
              fiatUsd: amount,
              method: _pay,
              assetPriceUsd: _price(_to),
              providerOverride: _buyProvider,
            );
          case EngineOp.sell:
            return _engine.quotes.quoteSell(
              asset: _from,
              network: _holding(_from)?.network ?? _network,
              cryptoAmount: amount,
              assetPriceUsd: _price(_from),
            );
          case EngineOp.swap:
            return _engine.quotes.quoteSwap(
              fromAsset: _from,
              toAsset: _to,
              network: _holding(_from)?.network ?? _network,
              fromAmount: amount,
              fromPrice: _price(_from),
              toPrice: _price(_to),
              slippageBps: _slippageBps,
            );
          case EngineOp.bridge:
            return _engine.quotes.quoteBridge(
              asset: _from,
              fromNetwork: _network,
              toNetwork: _destNetwork,
              amount: amount,
              priceUsd: _price(_from),
            );
          case EngineOp.stake:
            if (_stakeAction == _StakeAction.claim) {
              // Claim uses a tiny stake-shaped quote for fees/status consistency.
              return _engine.quotes.quoteStake(
                pool: _pool,
                amount: _pool.minStake,
                priceUsd: _price(_pool.asset),
              );
            }
            return _engine.quotes.quoteStake(
              pool: _pool,
              amount: amount,
              priceUsd: _price(_pool.asset),
            );
        }
      });
      if (!mounted) return;
      var moved = false;
      final prev = _prevQuote;
      if (prev != null &&
          prev.op == q.op &&
          prev.fromAsset == q.fromAsset &&
          prev.toAsset == q.toAsset &&
          prev.fromAmount > 0 &&
          q.toAmount > 0) {
        final delta = ((q.toAmount - prev.toAmount) / prev.toAmount).abs();
        moved = delta >= 0.02;
      }
      setState(() {
        _prevQuote = _quote;
        _quote = q;
        _network = q.sourceNetwork;
        _quoting = false;
        _priceMoved = moved;
      });
      _armAutoRefresh();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _quoting = false;
        _error = humanizeEngineError(e);
      });
    }
  }

  void _useMax() {
    if (widget.op == EngineOp.buy) return;
    final bal = _spendTickerBalance;
    if (bal <= 0) return;
    // Leave a tiny buffer for network fees on swap/bridge/stake.
    final usable = widget.op == EngineOp.sell ? bal : (bal * 0.995).clamp(0.0, bal);
    _amountCtrl.text = fmtEngineAmount(usable.toDouble());
    _refreshQuote();
  }

  Future<void> _goReview() async {
    await _checkConnectivity();
    if (_insufficient) {
      setState(() => _error = 'There isn’t enough balance for this amount.');
      return;
    }
    if (_quote == null || _quote!.isExpired) {
      await _refreshQuote();
      return;
    }
    setState(() {
      _phase = _Phase.review;
      _error = null;
    });
  }

  Future<void> _confirm() async {
    final quote = _quote;
    if (quote == null) return;
    final wallet = context.read<WalletController>();
    final portfolio = context.read<PortfolioController>();
    await _checkConnectivity();
    if (!mounted) return;
    if (_offline) {
      setState(() => _error = 'You’re offline. Reconnect, then try again.');
      return;
    }
    if (quote.isExpired) {
      setState(() => _error = 'This quote expired. Refresh for an updated price.');
      await _refreshQuote();
      return;
    }
    if (!_checkedFees || !_checkedDetails) {
      setState(() => _error = 'Confirm the checklist before continuing.');
      return;
    }
    if ((widget.op == EngineOp.bridge || widget.op == EngineOp.sell) && !_checkedIrreversible) {
      setState(() => _error = 'Confirm you understand this can’t be casually undone.');
      return;
    }
    if (_insufficient) {
      setState(() => _error = 'There isn’t enough balance for this amount.');
      return;
    }

    final authLabel = widget.op == EngineOp.buy
        ? 'Buy ${fmtEngineAmount(quote.toAmount)} ${quote.toAsset} for \$${fmtEngineAmount(quote.fromAmount)}'
        : '${widget.op.label} ${fmtEngineAmount(quote.fromAmount)} ${quote.fromAsset}';
    final ok = await engineAuthenticate(
      context,
      hasPin: wallet.hasPin,
      biometricsEnabled: wallet.biometricsEnabled,
      biometric: (r) => wallet.authenticateForTransfer(reason: r),
      verifyPin: wallet.verifyPin,
      reason: authLabel,
    );
    if (!ok || !mounted) return;

    setState(() {
      _phase = _Phase.progress;
      _liveStatus = EngineStatus.preparing;
      _error = null;
    });

    try {
      final receipt = await _engine.submit(
        quote: quote,
        portfolio: portfolio,
        walletAddress: wallet.addressFor(_network) ?? wallet.address ?? '',
        offline: _offline,
        onStatus: (s) {
          if (mounted) setState(() => _liveStatus = s);
        },
      );
      if (!mounted) return;
      setState(() {
        _receipt = receipt;
        _liveStatus = EngineStatus.completed;
        _phase = _Phase.done;
      });
      if (mounted) {
        context.read<IntelligenceController>().noteEvent('afterFirstTx');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = humanizeEngineError(e);
        _phase = _Phase.review;
        _liveStatus = EngineStatus.failed;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final nav = Navigator.of(context);
    return ChangeNotifierProvider.value(
      value: _engine,
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) async {
          if (didPop) return;
          if (await _confirmDiscard() && mounted) nav.pop();
        },
        child: Scaffold(
          appBar: AppBar(
            title: Text(widget.op.label),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () async {
                if (await _confirmDiscard() && mounted) nav.pop();
              },
            ),
            actions: [
              if (_phase == _Phase.configure)
                IconButton(
                  tooltip: 'Refresh quote',
                  onPressed: _quoting ? null : _refreshQuote,
                  icon: const Icon(Icons.refresh_rounded),
                ),
            ],
          ),
          body: SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: wide ? 560 : double.infinity),
                child: switch (_phase) {
                  _Phase.configure => _configure(),
                  _Phase.review => _review(),
                  _Phase.progress => Padding(
                      padding: const EdgeInsets.all(24),
                      child: EngineStatusTrack(
                        status: _liveStatus,
                        isPreview: _quote?.isPreview ?? true,
                      ),
                    ),
                  _Phase.done => EngineReceiptView(
                      receipt: _receipt!,
                      onDone: () => Navigator.pop(context),
                    ),
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _configure() {
    final tickers = _assets.map((a) => a.ticker).toSet().toList();
    if (!tickers.contains('USDC')) tickers.add('USDC');
    if (!tickers.contains('ETH')) tickers.add('ETH');

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      children: [
        Text(_subtitle, style: const TextStyle(color: AetherColors.muted, height: 1.4)),
        const SizedBox(height: 14),
        const SoftBanner(
          message:
              'Preview mode — quotes and fees are shown honestly. No payment partner or chain broadcast runs until live rails connect.',
        ),
        if (_offline) ...[
          const SizedBox(height: 10),
          const SoftBanner(
            tone: BannerTone.warn,
            message: 'You appear offline. You can prepare a quote; confirmation waits until you’re back online.',
          ),
        ],
        if (_engineTip != null) ...[
          const SizedBox(height: 10),
          SoftBanner(message: _engineTip!),
        ],
        const SizedBox(height: 14),
        ..._configureFields(tickers),
        const SizedBox(height: 12),
        if (_stakeAction != _StakeAction.claim)
          TextField(
            controller: _amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: widget.op == EngineOp.buy ? 'Amount (USD)' : 'Amount',
              suffixIcon: widget.op == EngineOp.buy
                  ? null
                  : TextButton(onPressed: _useMax, child: const Text('Max')),
            ),
            onEditingComplete: _refreshQuote,
          ),
        if (widget.op != EngineOp.buy && _stakeAction != _StakeAction.claim) ...[
          const SizedBox(height: 6),
          Text(
            'Available: ${fmtEngineAmount(_spendTickerBalance)} ${widget.op == EngineOp.stake ? _pool.asset : _from}',
            style: const TextStyle(color: AetherColors.muted, fontSize: 13),
          ),
        ],
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: _quoting ? null : _refreshQuote,
          child: const Text('Update quote'),
        ),
        const SizedBox(height: 14),
        if (_error != null) SoftBanner(tone: BannerTone.error, message: _error!),
        if (_insufficient)
          const SoftBanner(
            tone: BannerTone.error,
            message: 'There isn’t enough balance for this amount. Lower the amount or use Max.',
          ),
        if (_largeNotional && !_insufficient) ...[
          const SizedBox(height: 8),
          SoftBanner(
            tone: BannerTone.warn,
            message: widget.op == EngineOp.buy
                ? 'This is a larger purchase. Double-check the asset and payment method.'
                : 'This uses half or more of your balance (or \$1,000+). Pause and confirm the details.',
          ),
        ],
        if (_quote != null) ...[
          const SizedBox(height: 8),
          EngineQuoteCard(
            quote: _quote!,
            onRefresh: _refreshQuote,
            refreshing: _quoting,
            priceMoved: _priceMoved,
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: (_quote!.isExpired || _insufficient || _quoting) ? null : _goReview,
            child: const Text('Review'),
          ),
        ] else if (_quoting)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
      ],
    );
  }

  String? get _engineTip {
    switch (widget.op) {
      case EngineOp.buy:
        return _quote == null
            ? null
            : 'This quote expires in ${_quote!.secondsRemaining}s. Refresh if the timer runs out.';
      case EngineOp.sell:
        return 'Sell payouts may take longer than on-chain transfers depending on the payout method.';
      case EngineOp.swap:
        return _quote != null && _quote!.totalFeesUsd >= 5
            ? 'Network fees look elevated for this swap. Timing is never guaranteed.'
            : 'Price can move while you review. Refresh if amounts change.';
      case EngineOp.bridge:
        return 'Bridge transfers may take longer than normal transfers and usually can’t be cancelled once started.';
      case EngineOp.stake:
        return 'Staking may lock your assets for a period. Estimated rewards are never guaranteed.';
    }
  }

  String get _subtitle {
    switch (widget.op) {
      case EngineOp.buy:
        return 'Buy crypto with every fee listed before you pay.';
      case EngineOp.sell:
        return 'Sell crypto to cash. See payout, fees, and settlement time first.';
      case EngineOp.swap:
        return 'Swap assets with clear rate, protection, fees, and minimum received.';
      case EngineOp.bridge:
        return 'Move assets between networks. Arrival time and fees stay visible.';
      case EngineOp.stake:
        return 'Staking locks assets with a validator to earn rewards over time.';
    }
  }

  List<Widget> _configureFields(List<String> tickers) {
    switch (widget.op) {
      case EngineOp.buy:
        return [
          DropdownButtonFormField<String>(
            initialValue: tickers.contains(_to) ? _to : tickers.first,
            items: [for (final t in tickers) DropdownMenuItem(value: t, child: Text(t))],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _to = v);
              _refreshQuote();
            },
            decoration: const InputDecoration(labelText: 'Asset'),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<PaymentMethod>(
            initialValue: _pay,
            items: [
              for (final m in PaymentMethod.values.where((m) => m != PaymentMethod.balance))
                DropdownMenuItem(value: m, child: Text(m.label)),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _pay = v);
              _refreshQuote();
            },
            decoration: const InputDecoration(labelText: 'Payment method'),
          ),
          const SizedBox(height: 12),
          Text('Payment partner', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_buyOffers.isEmpty)
            const Text(
              'Update the amount to compare partners.',
              style: TextStyle(color: AetherColors.muted, fontSize: 13),
            )
          else
            for (final offer in _buyOffers)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: !offer.available
                        ? null
                        : () {
                            setState(() => _buyProvider = offer.code);
                            _refreshQuote();
                          },
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            _buyProvider == offer.code
                                ? Icons.radio_button_checked_rounded
                                : Icons.radio_button_unchecked_rounded,
                            color: offer.available ? AetherColors.lagoon : AetherColors.muted,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(offer.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                                const SizedBox(height: 4),
                                Text(
                                  [
                                    offer.methodsLabel,
                                    offer.processingLabel,
                                    'Fees ~\$${offer.totalFeesUsd.toStringAsFixed(2)}',
                                    'You get ~${fmtEngineAmount(offer.youReceive)} $_to',
                                    if (!offer.available) offer.unavailableReason ?? 'Unavailable',
                                  ].join(' · '),
                                  style: const TextStyle(fontSize: 12, height: 1.35, color: AetherColors.muted),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          if (_buyProvider != 'auvora-sim') ...[
            const SizedBox(height: 8),
            const SoftBanner(
              tone: BannerTone.warn,
              message:
                  'Identity verification (KYC) is required by most payment partners before live purchases. This Closed Beta shows the hook only.',
            ),
          ],
        ];
      case EngineOp.sell:
        return [
          DropdownButtonFormField<String>(
            initialValue: tickers.contains(_from) ? _from : tickers.first,
            items: [for (final t in tickers) DropdownMenuItem(value: t, child: Text(t))],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _from = v);
              _refreshQuote();
            },
            decoration: const InputDecoration(labelText: 'Asset to sell'),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _sellDestination,
            items: const [
              DropdownMenuItem(value: 'bank', child: Text('Bank account')),
              DropdownMenuItem(value: 'card', child: Text('Debit card')),
              DropdownMenuItem(value: 'balance', child: Text('Cash balance (preview)')),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _sellDestination = v);
              _refreshQuote();
            },
            decoration: const InputDecoration(labelText: 'Destination account'),
          ),
          const SizedBox(height: 8),
          SoftBanner(
            message: _sellDestination == 'bank'
                ? 'Bank payouts often take 1–3 business days after partner approval.'
                : 'Destination is a preview destination until off-ramp partners connect.',
          ),
        ];
      case EngineOp.swap:
        return [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: tickers.contains(_from) ? _from : tickers.first,
                  items: [for (final t in tickers) DropdownMenuItem(value: t, child: Text(t))],
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _from = v);
                    _refreshQuote();
                  },
                  decoration: const InputDecoration(labelText: 'From'),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: IconButton(
                  tooltip: 'Reverse',
                  constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                  onPressed: () {
                    setState(() {
                      final tmp = _from;
                      _from = _to;
                      _to = tmp;
                    });
                    _refreshQuote();
                  },
                  icon: const Icon(Icons.swap_vert_rounded),
                ),
              ),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: tickers.contains(_to) ? _to : tickers.first,
                  items: [for (final t in tickers) DropdownMenuItem(value: t, child: Text(t))],
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _to = v);
                    _refreshQuote();
                  },
                  decoration: const InputDecoration(labelText: 'To'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<int>(
            initialValue: _slippageBps,
            items: const [
              DropdownMenuItem(value: 30, child: Text('0.30% price protection')),
              DropdownMenuItem(value: 50, child: Text('0.50% price protection')),
              DropdownMenuItem(value: 100, child: Text('1.00% price protection')),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _slippageBps = v);
              _refreshQuote();
            },
            decoration: const InputDecoration(labelText: 'If the price moves'),
          ),
        ];
      case EngineOp.bridge:
        return [
          DropdownButtonFormField<String>(
            initialValue: tickers.contains(_from) ? _from : tickers.first,
            items: [for (final t in tickers) DropdownMenuItem(value: t, child: Text(t))],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _from = v);
              _refreshQuote();
            },
            decoration: const InputDecoration(labelText: 'Asset'),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<AssetNetwork>(
            initialValue: _network,
            items: [for (final n in AssetNetwork.values) DropdownMenuItem(value: n, child: Text(n.label))],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _network = v);
              _refreshQuote();
            },
            decoration: const InputDecoration(labelText: 'From network'),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<AssetNetwork>(
            initialValue: _destNetwork,
            items: [for (final n in AssetNetwork.values) DropdownMenuItem(value: n, child: Text(n.label))],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _destNetwork = v);
              _refreshQuote();
            },
            decoration: const InputDecoration(labelText: 'To network'),
          ),
          const SizedBox(height: 8),
          const SoftBanner(
            tone: BannerTone.warn,
            message: 'Bridges can take time and usually can’t be cancelled once started.',
          ),
        ];
      case EngineOp.stake:
        return [
          SegmentedButton<_StakeAction>(
            segments: const [
              ButtonSegment(value: _StakeAction.stake, label: Text('Stake')),
              ButtonSegment(value: _StakeAction.unstake, label: Text('Unstake')),
              ButtonSegment(value: _StakeAction.claim, label: Text('Claim')),
            ],
            selected: {_stakeAction},
            onSelectionChanged: (s) {
              setState(() => _stakeAction = s.first);
              _refreshQuote();
            },
          ),
          const SizedBox(height: 12),
          Text(
            switch (_stakeAction) {
              _StakeAction.stake =>
                'You keep ownership. Rewards accrue over time. Unstaking may take a short waiting period.',
              _StakeAction.unstake =>
                'Unstaking starts a waiting period before funds return. Rewards stop accruing on that amount.',
              _StakeAction.claim => 'Claim moves earned rewards into your available balance (preview).',
            },
            style: const TextStyle(color: AetherColors.muted, height: 1.4, fontSize: 13),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _pool.id,
            items: [
              for (final p in QuoteEngine.stakePools)
                DropdownMenuItem(
                  value: p.id,
                  child: Text('${p.asset} · ${p.apyPct}% / yr · ${p.validatorName}'),
                ),
            ],
            onChanged: (v) {
              if (v == null) return;
              final pool = QuoteEngine.stakePools.firstWhere((p) => p.id == v);
              setState(() {
                _pool = pool;
                _from = pool.asset;
                _network = pool.network;
              });
              _refreshQuote();
            },
            decoration: const InputDecoration(labelText: 'Validator'),
          ),
          const SizedBox(height: 8),
          Text(
            'Waiting period after unstake: about ${_pool.lockDays} day(s). Validator keeps ${_pool.commissionPct}% of rewards.',
            style: const TextStyle(color: AetherColors.muted, height: 1.4, fontSize: 13),
          ),
          if (_stakeAction == _StakeAction.claim) ...[
            const SizedBox(height: 12),
            SoftBanner(
              message:
                  'Estimated rewards ready: ${fmtEngineAmount(_pool.minStake * 0.12)} ${_pool.asset} (preview history).',
            ),
          ],
        ];
    }
  }

  Widget _review() {
    final q = _quote!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      children: [
        const Text(
          'Confirm every fee and amount. Nothing continues until you authorize.',
          style: TextStyle(color: AetherColors.muted, height: 1.45),
        ),
        if (_priceMoved) ...[
          const SizedBox(height: 8),
          const SoftBanner(
            tone: BannerTone.warn,
            message: 'Price changed while reviewing your order. Refresh and confirm the new amounts.',
          ),
        ],
        if (context.watch<IntelligenceController>().pendingTip case final tip?) ...[
          const SizedBox(height: 12),
          IntelligenceTipCard(
            title: tip.title,
            body: tip.body,
            onDismiss: () => context.read<IntelligenceController>().dismissTip(tip.id),
          ),
        ],
        const SizedBox(height: 12),
        EngineQuoteCard(
          quote: q,
          priceMoved: _priceMoved,
          onRefresh: () async {
            await _refreshQuote();
            if (mounted) setState(() => _phase = _Phase.configure);
          },
        ),
        const SizedBox(height: 12),
        if (q.isExpired)
          const SoftBanner(
            tone: BannerTone.error,
            message: 'This quote expired. Go back and refresh before confirming.',
          ),
        if (_offline)
          const SoftBanner(
            tone: BannerTone.error,
            message: 'You’re offline. Reconnect to authorize securely.',
          ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: _checkedFees,
          onChanged: (v) => setState(() => _checkedFees = v == true),
          title: Text(
            'I understand the fees (about \$${q.totalFeesUsd.toStringAsFixed(2)} total)',
          ),
          controlAffinity: ListTileControlAffinity.leading,
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: _checkedDetails,
          onChanged: (v) => setState(() => _checkedDetails = v == true),
          title: Text(
            'I confirm ${fmtEngineAmount(q.fromAmount)} ${q.fromAsset} → ${fmtEngineAmount(q.toAmount)} ${q.toAsset}',
          ),
          controlAffinity: ListTileControlAffinity.leading,
        ),
        if (widget.op == EngineOp.bridge || widget.op == EngineOp.sell)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: _checkedIrreversible,
            onChanged: (v) => setState(() => _checkedIrreversible = v == true),
            title: Text(
              widget.op == EngineOp.bridge
                  ? 'I understand bridging usually can’t be cancelled once started'
                  : 'I understand settled sales usually can’t be reversed',
            ),
            controlAffinity: ListTileControlAffinity.leading,
          ),
        if (_error != null) SoftBanner(tone: BannerTone.error, message: _error!),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: (q.isExpired || _offline) ? null : _confirm,
          child: Text(q.isPreview ? 'Authorize preview' : 'Authenticate to ${widget.op.label.toLowerCase()}'),
        ),
        TextButton(
          onPressed: () => setState(() => _phase = _Phase.configure),
          child: const Text('Back'),
        ),
      ],
    );
  }
}
