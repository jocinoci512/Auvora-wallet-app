import 'package:flutter/foundation.dart';

import 'wallet_connect_provider.dart';

/// Holds inbound deep-link / WalletConnect URIs until the Connect flow consumes them.
class DeepLinkRouter extends ChangeNotifier {
  DeepLinkRouter({WalletConnectProviderPort? provider})
      : _provider = provider ?? PreviewWalletConnectProvider();

  final WalletConnectProviderPort _provider;
  String? _pendingUri;
  DeepLinkValidation? _lastValidation;
  final List<String> _recent = [];

  String? get pendingUri => _pendingUri;
  DeepLinkValidation? get lastValidation => _lastValidation;
  List<String> get recent => List.unmodifiable(_recent);

  WalletConnectProviderPort get provider => _provider;

  /// Validate and queue a URI from OS deep link, paste, or QR.
  DeepLinkValidation ingest(String raw) {
    final validation = _provider.validateInboundUri(raw);
    _lastValidation = validation;
    if (validation.valid && validation.extractedUri != null) {
      _pendingUri = validation.extractedUri;
      _recent.insert(0, validation.extractedUri!);
      if (_recent.length > 12) _recent.removeLast();
    } else {
      // Keep invalid links out of the pending queue.
      _pendingUri = null;
    }
    notifyListeners();
    return validation;
  }

  String? takePending() {
    final value = _pendingUri;
    _pendingUri = null;
    notifyListeners();
    return value;
  }

  void clear() {
    _pendingUri = null;
    _lastValidation = null;
    notifyListeners();
  }
}
