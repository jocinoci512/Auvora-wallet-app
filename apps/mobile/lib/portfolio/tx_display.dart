import '../release/network_env.dart';
import 'models.dart';

extension PortfolioTxDisplay on PortfolioTx {
  String get displayNetworkLabel => AuvoraNetworkEnv.displayName(network);
}

extension AssetHoldingDisplay on AssetHolding {
  String get displayNetworkLabel => AuvoraNetworkEnv.displayName(network);
}

extension AssetNetworkDisplay on AssetNetwork {
  String get displayNetworkLabel => AuvoraNetworkEnv.displayName(this);
}
