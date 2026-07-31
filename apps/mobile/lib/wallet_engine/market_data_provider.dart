import 'models.dart';

enum ChartRange { d1, d7, d30, y1, all }

/// Pluggable market-data source. Implementations must never throw to callers —
/// return empty maps/lists so [PriceService] can fail over.
abstract class MarketDataProvider {
  String get id;

  Future<Map<String, PricePoint>> fetchQuotes(Iterable<String> symbols);

  Future<List<double>> fetchHistory(String symbol, ChartRange range);
}
