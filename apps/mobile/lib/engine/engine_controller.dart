import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../portfolio/models.dart';
import '../portfolio/portfolio_controller.dart';
import 'models.dart';
import 'quote_engine.dart';

typedef EngineStatusListener = void Function(EngineStatus status);

class EngineController extends ChangeNotifier {
  EngineController({QuoteEngine? quotes}) : _quotes = quotes ?? QuoteEngine();

  final QuoteEngine _quotes;
  static const _uuid = Uuid();

  final List<EngineReceipt> history = [];
  final Set<String> _consumedQuoteIds = {};
  bool busy = false;
  bool submitting = false;
  String? errorMessage;
  AssetQuote? activeQuote;
  EngineStatus? liveStatus;

  QuoteEngine get quotes => _quotes;

  Future<AssetQuote> refresh(Future<AssetQuote> Function() builder) async {
    busy = true;
    errorMessage = null;
    notifyListeners();
    try {
      activeQuote = await builder();
      return activeQuote!;
    } catch (e) {
      errorMessage = humanizeEngineError(e);
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void clearError() {
    errorMessage = null;
    notifyListeners();
  }

  void assertQuoteFresh(AssetQuote quote) {
    if (quote.isExpired) {
      throw QuoteException('This quote expired. Refresh for an updated price.');
    }
  }

  void assertSufficientBalance(AssetQuote quote, PortfolioController portfolio) {
    if (quote.op == EngineOp.buy) return;
    final snap = portfolio.snapshot;
    if (snap == null) return;
    AssetHolding? holding;
    for (final a in snap.assets) {
      if (a.ticker == quote.fromAsset) {
        holding = a;
        break;
      }
    }
    final bal = holding?.balance ?? 0;
    if (quote.fromAmount > bal + 1e-12) {
      throw QuoteException(
        'There isn’t enough ${quote.fromAsset}. You have ${_fmtBal(bal)}; this needs ${_fmtBal(quote.fromAmount)}.',
      );
    }
  }

  Future<EngineReceipt> submit({
    required AssetQuote quote,
    required PortfolioController portfolio,
    required String walletAddress,
    EngineStatusListener? onStatus,
    bool offline = false,
  }) async {
    if (offline) {
      throw QuoteException('You’re offline. Reconnect, then try again.');
    }
    if (submitting) {
      throw QuoteException('This request is already in progress.');
    }
    if (_consumedQuoteIds.contains(quote.id)) {
      throw QuoteException('This quote was already used. Refresh for a new quote.');
    }
    assertQuoteFresh(quote);
    assertSufficientBalance(quote, portfolio);
    submitting = true;
    liveStatus = EngineStatus.preparing;
    onStatus?.call(EngineStatus.preparing);
    notifyListeners();
    try {
      final id = 'eng-${_uuid.v4().substring(0, 10)}';
      final reference =
          '0x${id.hashCode.toRadixString(16)}${quote.id.hashCode.abs().toRadixString(16)}';
      _consumedQuoteIds.add(quote.id);

      var receipt = EngineReceipt(
        id: id,
        op: quote.op,
        status: EngineStatus.preparing,
        fromAsset: quote.fromAsset,
        toAsset: quote.toAsset,
        fromAmount: quote.fromAmount,
        toAmount: quote.toAmount,
        fees: quote.fees,
        networkLabel: quote.destNetwork != null
            ? '${quote.sourceNetwork.label} → ${quote.destNetwork!.label}'
            : quote.sourceNetwork.label,
        createdAt: DateTime.now(),
        reference: reference,
        provider: quote.provider,
        isPreview: quote.isPreview,
        note: quote.isPreview
            ? 'Preview only — no funds moved on-chain or to a payment partner.'
            : 'Secured on this device. You can review this anytime in Activity.',
      );
      history.insert(0, receipt);
      notifyListeners();

      await Future<void>.delayed(const Duration(milliseconds: 450));
      liveStatus = EngineStatus.waitingConfirmation;
      onStatus?.call(EngineStatus.waitingConfirmation);
      receipt = _withStatus(receipt, EngineStatus.waitingConfirmation);
      _replace(receipt);

      await Future<void>.delayed(const Duration(milliseconds: 650));
      liveStatus = EngineStatus.processing;
      onStatus?.call(EngineStatus.processing);
      receipt = _withStatus(receipt, EngineStatus.processing);
      _replace(receipt);

      await _applyPortfolio(quote, portfolio, walletAddress, reference);

      await Future<void>.delayed(const Duration(milliseconds: 500));
      liveStatus = EngineStatus.completed;
      onStatus?.call(EngineStatus.completed);
      receipt = _withStatus(receipt, EngineStatus.completed);
      _replace(receipt);
      return receipt;
    } catch (e) {
      liveStatus = EngineStatus.failed;
      onStatus?.call(EngineStatus.failed);
      errorMessage = humanizeEngineError(e);
      rethrow;
    } finally {
      submitting = false;
      notifyListeners();
    }
  }

  EngineReceipt _withStatus(EngineReceipt r, EngineStatus status) {
    return EngineReceipt(
      id: r.id,
      op: r.op,
      status: status,
      fromAsset: r.fromAsset,
      toAsset: r.toAsset,
      fromAmount: r.fromAmount,
      toAmount: r.toAmount,
      fees: r.fees,
      networkLabel: r.networkLabel,
      createdAt: r.createdAt,
      reference: r.reference,
      provider: r.provider,
      note: r.note,
      isPreview: r.isPreview,
    );
  }

  void _replace(EngineReceipt r) {
    final i = history.indexWhere((h) => h.id == r.id);
    if (i >= 0) {
      history[i] = r;
    } else {
      history.insert(0, r);
    }
    notifyListeners();
  }

  Future<void> _applyPortfolio(
    AssetQuote quote,
    PortfolioController portfolio,
    String from,
    String reference,
  ) async {
    final snap = portfolio.snapshot;
    if (snap == null) return;

    final type = switch (quote.op) {
      EngineOp.buy => TxType.buy,
      EngineOp.sell => TxType.sell,
      EngineOp.swap => TxType.swap,
      EngineOp.bridge => TxType.bridge,
      EngineOp.stake => TxType.stake,
    };

    final ticker = quote.op == EngineOp.buy || quote.op == EngineOp.swap || quote.op == EngineOp.bridge
        ? quote.toAsset.replaceFirst('st', '')
        : quote.fromAsset;
    final amount = quote.op == EngineOp.sell ? quote.fromAmount : quote.toAmount;

    var assets = [...snap.assets];
    if (quote.op == EngineOp.sell ||
        quote.op == EngineOp.swap ||
        quote.op == EngineOp.stake ||
        quote.op == EngineOp.bridge) {
      assets = assets.map((a) {
        if (a.ticker != quote.fromAsset) return a;
        return a.copyWith(balance: (a.balance - quote.fromAmount).clamp(0.0, double.infinity).toDouble());
      }).toList();
    }
    if (quote.op == EngineOp.buy || quote.op == EngineOp.swap) {
      assets = assets.map((a) {
        if (a.ticker != quote.toAsset) return a;
        return a.copyWith(balance: a.balance + quote.toAmount);
      }).toList();
    }

    final amountUsd = switch (quote.op) {
      EngineOp.buy => quote.fromAmount,
      EngineOp.sell => quote.toAmount,
      _ => quote.fromAmount * (snap.assets.where((a) => a.ticker == quote.fromAsset).firstOrNull?.priceUsd ?? 1),
    };

    final tx = PortfolioTx(
      id: 'eng-tx-${quote.id}',
      type: type,
      status: quote.isPreview ? TxStatus.pending : TxStatus.completed,
      network: quote.sourceNetwork,
      assetTicker: ticker,
      amount: amount,
      amountUsd: amountUsd,
      timestamp: DateTime.now(),
      from: from,
      to: quote.op == EngineOp.stake ? (quote.validatorName ?? 'Validator') : from,
      hash: reference,
      fee: quote.fees.isEmpty ? null : quote.fees.first.amount,
      feeAsset: quote.fees.isEmpty ? null : quote.fees.first.asset,
      note: quote.isPreview ? 'Preview · ${quote.routeSummary ?? quote.op.label}' : quote.routeSummary,
    );

    portfolio.applyLocalSnapshot(
      assets: assets,
      prependTx: tx,
    );
  }

  String _fmtBal(double n) {
    if (n >= 100) return n.toStringAsFixed(2);
    if (n >= 1) return n.toStringAsFixed(4);
    return n.toStringAsFixed(6);
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    if (it.moveNext()) return it.current;
    return null;
  }
}
