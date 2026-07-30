import 'models.dart';

/// Local portfolio source until live chain + price APIs are wired (Sprint 3+).
class PortfolioRepository {
  Future<PortfolioSnapshot> load({required String? walletAddress, bool empty = false}) async {
    await Future<void>.delayed(const Duration(milliseconds: 280));

    if (empty || walletAddress == null) {
      return PortfolioSnapshot(
        assets: _catalog(balances: const {}),
        transactions: const [],
        contacts: _contacts,
        trend7d: const [0, 0, 0, 0, 0, 0, 0],
        change24hUsd: 0,
        change24hPct: 0,
        updatedAt: DateTime.now(),
        isPreview: true,
      );
    }

    final assets = _catalog(
      balances: {
        'eth': 1.2842,
        'btc': 0.0421,
        'sol': 48.5,
        'usdc': 1250.0,
        'pol': 820.0,
        'avax': 0.0,
      },
    );

    final total = assets.fold<double>(0, (s, a) => s + a.fiatValue);
    final changePct = 1.84;
    final changeUsd = total * (changePct / 100);

    return PortfolioSnapshot(
      assets: assets,
      transactions: _transactions(walletAddress),
      contacts: _contacts,
      trend7d: const [41200, 42150, 41800, 43200, 44100, 43850, 45210],
      change24hUsd: changeUsd,
      change24hPct: changePct,
      updatedAt: DateTime.now(),
      isPreview: true,
      syncDelayed: false,
      priceError: false,
      offline: false,
    );
  }

  List<AssetHolding> _catalog({required Map<String, double> balances}) {
    return [
      AssetHolding(
        id: 'eth',
        name: 'Ethereum',
        ticker: 'ETH',
        network: AssetNetwork.ethereum,
        balance: balances['eth'] ?? 0,
        priceUsd: 3240.12,
        change24hPct: 1.62,
        color: 0xFF627EEA,
        sparkline: const [3100, 3180, 3150, 3220, 3190, 3260, 3240],
      ),
      AssetHolding(
        id: 'btc',
        name: 'Bitcoin',
        ticker: 'BTC',
        network: AssetNetwork.bitcoin,
        balance: balances['btc'] ?? 0,
        priceUsd: 64210.0,
        change24hPct: 0.84,
        color: 0xFFF7931A,
        sparkline: const [62800, 63100, 63500, 62900, 64000, 63800, 64210],
      ),
      AssetHolding(
        id: 'sol',
        name: 'Solana',
        ticker: 'SOL',
        network: AssetNetwork.solana,
        balance: balances['sol'] ?? 0,
        priceUsd: 148.2,
        change24hPct: -0.92,
        color: 0xFF0E8A6A,
        sparkline: const [152, 150, 149, 151, 147, 146, 148],
      ),
      AssetHolding(
        id: 'usdc',
        name: 'USD Coin',
        ticker: 'USDC',
        network: AssetNetwork.ethereum,
        balance: balances['usdc'] ?? 0,
        priceUsd: 1.0,
        change24hPct: 0.01,
        color: 0xFF2775CA,
        sparkline: const [1, 1, 1, 1, 1, 1, 1],
      ),
      AssetHolding(
        id: 'pol',
        name: 'Polygon',
        ticker: 'POL',
        network: AssetNetwork.polygon,
        balance: balances['pol'] ?? 0,
        priceUsd: 0.42,
        change24hPct: 2.4,
        color: 0xFF2A7A6B,
        sparkline: const [0.38, 0.39, 0.40, 0.41, 0.40, 0.41, 0.42],
      ),
      AssetHolding(
        id: 'avax',
        name: 'Avalanche',
        ticker: 'AVAX',
        network: AssetNetwork.ethereum,
        balance: balances['avax'] ?? 0,
        priceUsd: 28.4,
        change24hPct: -1.1,
        color: 0xFFE84142,
        sparkline: const [29.2, 28.9, 28.6, 28.8, 28.3, 28.5, 28.4],
      ),
    ];
  }

  List<PortfolioTx> _transactions(String address) {
    final now = DateTime.now();
    final short = address.length > 10 ? '${address.substring(0, 6)}…${address.substring(address.length - 4)}' : address;
    return [
      PortfolioTx(
        id: 'tx1',
        type: TxType.receive,
        status: TxStatus.completed,
        network: AssetNetwork.ethereum,
        assetTicker: 'ETH',
        amount: 0.42,
        amountUsd: 1360.85,
        timestamp: now.subtract(const Duration(hours: 5)),
        from: '0x8f3a…91c2',
        to: short,
        hash: '0x9a4f2c8e1b7d6a5f3e2c1b0a9876543210fedcba',
        fee: 0.0012,
        feeAsset: 'ETH',
        note: 'From exchange',
      ),
      PortfolioTx(
        id: 'tx2',
        type: TxType.swap,
        status: TxStatus.completed,
        network: AssetNetwork.ethereum,
        assetTicker: 'USDC',
        amount: 500,
        amountUsd: 500,
        timestamp: now.subtract(const Duration(days: 1, hours: 3)),
        from: short,
        to: short,
        hash: '0x1b2c3d4e5f678901234567890abcdef12345678',
        fee: 0.0021,
        feeAsset: 'ETH',
        note: 'ETH → USDC',
      ),
      PortfolioTx(
        id: 'tx3',
        type: TxType.send,
        status: TxStatus.pending,
        network: AssetNetwork.solana,
        assetTicker: 'SOL',
        amount: 2.5,
        amountUsd: 370.5,
        timestamp: now.subtract(const Duration(minutes: 18)),
        from: short,
        to: '7nYq…kL9p',
        hash: '5Kd9mN2pQ8rT1vW3xY6zA4bC7dE0fG2hJ5kL8mN',
        fee: 0.00005,
        feeAsset: 'SOL',
      ),
      PortfolioTx(
        id: 'tx4',
        type: TxType.buy,
        status: TxStatus.completed,
        network: AssetNetwork.bitcoin,
        assetTicker: 'BTC',
        amount: 0.01,
        amountUsd: 642.1,
        timestamp: now.subtract(const Duration(days: 3)),
        from: 'Card ****4242',
        to: short,
        hash: 'b10c4a9e8f7d6c5b4a39281706f5e4d3c2b1a09',
        fee: 1.99,
        feeAsset: 'USD',
      ),
      PortfolioTx(
        id: 'tx5',
        type: TxType.bridge,
        status: TxStatus.failed,
        network: AssetNetwork.polygon,
        assetTicker: 'POL',
        amount: 100,
        amountUsd: 42,
        timestamp: now.subtract(const Duration(days: 4)),
        from: short,
        to: short,
        hash: '0xdeadbeefcafe00112233445566778899aabbcc',
        fee: 0.4,
        feeAsset: 'POL',
        note: 'Bridge timed out — funds returned',
      ),
      PortfolioTx(
        id: 'tx6',
        type: TxType.stake,
        status: TxStatus.cancelled,
        network: AssetNetwork.ethereum,
        assetTicker: 'ETH',
        amount: 0.1,
        amountUsd: 324,
        timestamp: now.subtract(const Duration(days: 6)),
        from: short,
        to: 'Staking pool',
        hash: '0xcafebabe11223344556677889900aabbccddee',
        fee: 0.001,
        feeAsset: 'ETH',
      ),
    ];
  }

  static const _contacts = [
    AddressContact(
      id: 'c1',
      name: 'Exchange deposit',
      address: '0x8f3a21b9c4d5e6f708192a3b4c5d6e7f8191c2',
      network: AssetNetwork.ethereum,
    ),
    AddressContact(
      id: 'c2',
      name: 'Savings cold',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      network: AssetNetwork.bitcoin,
    ),
  ];
}
