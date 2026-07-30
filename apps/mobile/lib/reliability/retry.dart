import 'dart:async';
import 'dart:math';

/// Capped exponential backoff for idempotent reads (ping / balance / history).
/// Never use for mutating send/sign without explicit user re-auth.
Future<T> withRetry<T>(
  Future<T> Function() action, {
  int maxAttempts = 3,
  Duration initialDelay = const Duration(milliseconds: 120),
  double multiplier = 2,
  Duration maxDelay = const Duration(seconds: 2),
  bool Function(Object error)? retryIf,
  void Function(int attempt, Object error)? onRetry,
}) async {
  assert(maxAttempts >= 1);
  Object? lastError;
  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      final canRetry = attempt < maxAttempts && (retryIf?.call(error) ?? true);
      if (!canRetry) rethrow;
      onRetry?.call(attempt, error);
      final exp = initialDelay.inMilliseconds * pow(multiplier, attempt - 1);
      final ms = min(exp.toInt(), maxDelay.inMilliseconds);
      await Future<void>.delayed(Duration(milliseconds: ms));
    }
  }
  throw lastError!;
}
