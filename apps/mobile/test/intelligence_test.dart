import 'package:auvora_wallet/intelligence/catalog.dart';
import 'package:auvora_wallet/intelligence/intelligence_controller.dart';
import 'package:auvora_wallet/intelligence/models.dart';
import 'package:auvora_wallet/intelligence/portfolio_summaries.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('catalog never frames buy/sell advice in portfolio summaries', () {
    final snap = PortfolioSnapshot(
      assets: [
        const AssetHolding(
          id: 'btc',
          name: 'Bitcoin',
          ticker: 'BTC',
          network: AssetNetwork.bitcoin,
          balance: 1,
          priceUsd: 64000,
          change24hPct: 2.4,
          color: 0xFFF7931A,
          sparkline: [1, 2, 3, 4, 5, 6, 7],
        ),
        const AssetHolding(
          id: 'usdc',
          name: 'USD Coin',
          ticker: 'USDC',
          network: AssetNetwork.ethereum,
          balance: 1000,
          priceUsd: 1,
          change24hPct: 0.01,
          color: 0xFF2775CA,
          sparkline: [1, 1, 1, 1, 1, 1, 1],
        ),
      ],
      transactions: [
        PortfolioTx(
          id: 't1',
          type: TxType.send,
          status: TxStatus.completed,
          network: AssetNetwork.ethereum,
          assetTicker: 'USDC',
          amount: 50,
          amountUsd: 50,
          timestamp: DateTime.now(),
          from: 'a',
          to: 'b',
          hash: '0x1',
        ),
        PortfolioTx(
          id: 't2',
          type: TxType.receive,
          status: TxStatus.completed,
          network: AssetNetwork.ethereum,
          assetTicker: 'USDC',
          amount: 20,
          amountUsd: 20,
          timestamp: DateTime.now(),
          from: 'c',
          to: 'd',
          hash: '0x2',
        ),
      ],
      contacts: const [],
      trend7d: const [1, 1, 1, 1, 1, 1, 1],
      change24hUsd: 100,
      change24hPct: 1.2,
      updatedAt: DateTime.now(),
      isPreview: true,
    );

    final lines = PortfolioIntelligence.summarize(snap, maxLines: 2);
    expect(lines, isNotEmpty);
    expect(lines.length, lessThanOrEqualTo(2));
    final blob = lines.map((l) => l.text.toLowerCase()).join(' ');
    expect(blob.contains('buy'), isFalse);
    expect(blob.contains('sell'), isFalse);
    expect(blob.contains('should'), isFalse);
  });

  test('transaction explanations include what / why / next', () {
    final tx = PortfolioTx(
      id: 'p1',
      type: TxType.send,
      status: TxStatus.pending,
      network: AssetNetwork.ethereum,
      assetTicker: 'ETH',
      amount: 0.1,
      amountUsd: 320,
      timestamp: DateTime.now(),
      from: 'a',
      to: 'b',
      hash: '0xabc',
    );
    final exp = IntelligenceCatalog.explainTransaction(tx);
    expect(exp.whatHappened, isNotEmpty);
    expect(exp.whyItMatters, isNotEmpty);
    expect(exp.whatYouCanDo, isNotEmpty);
  });

  test('search assist finds fees and security', () {
    expect(IntelligenceCatalog.searchAssist('fee').any((h) => h.route == 'learn'), isTrue);
    expect(IntelligenceCatalog.searchAssist('security').any((h) => h.route == 'security'), isTrue);
  });

  test('guidance prefs respect minimal and dismissals', () async {
    final controller = IntelligenceController();
    await controller.bootstrap();
    await controller.setGuidanceLevel(GuidanceLevel.minimal);
    expect(controller.showEducationalHints, isFalse);
    expect(controller.shouldShowExplanation(IntelligenceKind.security), isTrue);
    expect(controller.shouldShowExplanation(IntelligenceKind.portfolio), isFalse);
    expect(controller.portfolioSummaries(null), isEmpty);

    await controller.setGuidanceLevel(GuidanceLevel.full);
    await controller.setEducationalHints(true);
    expect(controller.tipFor('homeIdle'), isNull);
    controller.noteEvent('afterImport');
    expect(controller.pendingTip?.id, 'tip-after-import');
    await controller.dismissTip('tip-after-import');
    expect(controller.pendingTip, isNull);
    expect(controller.prefs.allowExternalAi, isFalse);
  });

  test('compact mode for routine explanations', () async {
    final controller = IntelligenceController();
    await controller.bootstrap();
    await controller.setGuidanceLevel(GuidanceLevel.balanced);
    final done = IntelligenceCatalog.explainTransaction(
      PortfolioTx(
        id: 'p1',
        type: TxType.send,
        status: TxStatus.completed,
        network: AssetNetwork.ethereum,
        assetTicker: 'ETH',
        amount: 0.1,
        amountUsd: 320,
        timestamp: DateTime.now(),
        from: 'a',
        to: 'b',
        hash: '0xabc',
      ),
    );
    expect(controller.useCompactExplanation(done), isTrue);
    final failed = IntelligenceCatalog.explainTransaction(
      PortfolioTx(
        id: 'p2',
        type: TxType.send,
        status: TxStatus.failed,
        network: AssetNetwork.ethereum,
        assetTicker: 'ETH',
        amount: 0.1,
        amountUsd: 320,
        timestamp: DateTime.now(),
        from: 'a',
        to: 'b',
        hash: '0xdef',
      ),
    );
    expect(controller.useCompactExplanation(failed), isFalse);
  });

  test('advice refusal patterns exist in fee and security copy', () {
    final fee = IntelligenceCatalog.explainFeeEstimate(networkLabel: 'Ethereum', elevated: true);
    expect(fee.whatYouCanDo.toLowerCase().contains('your choice'), isTrue);
    final conn = IntelligenceCatalog.explainConnection(
      origin: 'example.com',
      lookalike: true,
      unknown: false,
    );
    expect(conn.whatYouCanDo.toLowerCase().contains('decline'), isTrue);
  });
}
