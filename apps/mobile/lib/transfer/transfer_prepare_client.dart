import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../account/auvora_api_config.dart';
import '../account/auth_api_client.dart';
import '../account/auvora_connectivity.dart';
import '../release/network_env.dart';
import '../state/wallet_session_restore.dart';

/// Safe, non-custodial response from transfer preparation.
class TransferPrepareResult {
  const TransferPrepareResult({
    required this.allowed,
    required this.status,
    required this.message,
    this.reviewId,
    this.reviewStatus,
    this.requestedAt,
    this.customerReason,
    this.customerStatus,
  });

  final bool allowed;
  final String status;
  final String message;
  final String? reviewId;
  final String? reviewStatus;
  final String? requestedAt;
  final String? customerReason;
  final String? customerStatus;

  factory TransferPrepareResult.fromJson(Map<String, dynamic> json) => TransferPrepareResult(
        allowed: json['allowed'] == true,
        status: (json['status'] ?? json['customerStatus'] ?? '').toString(),
        message: (json['message'] ?? 'Transaction pending review').toString(),
        reviewId: (json['reviewId'] ?? json['id'])?.toString(),
        reviewStatus: json['reviewStatus']?.toString() ?? json['status']?.toString(),
        requestedAt: json['requestedAt']?.toString(),
        customerReason: json['customerReason']?.toString(),
        customerStatus: json['customerStatus']?.toString(),
      );
}

/// Calls the authoritative wallet prepare endpoint before local signing.
class TransferPrepareClient {
  TransferPrepareClient({
    http.Client? httpClient,
    String? baseUrl,
    this.timeout = const Duration(seconds: 20),
  })  : _http = httpClient ?? http.Client(),
        _baseUrl = (baseUrl ?? AuvoraApiConfig.baseUrl).trim();

  final http.Client _http;
  final String _baseUrl;
  final Duration timeout;

  bool get isConfigured => _baseUrl.isNotEmpty;

  Future<TransferPrepareResult> prepare({
    required String accessToken,
    required String assetCode,
    required String destinationAddress,
    required String amount,
    required String idempotencyKey,
    String? fromAddress,
    int? qaNotionalUsdCents,
  }) async {
    if (!isConfigured) {
      throw const AuthException(
        AuthErrorKind.notConfigured,
        'Account backend is not configured for this build.',
      );
    }
    try {
      final res = await _http
          .post(
            Uri.parse('${_baseUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1/wallets/transfers/prepare'),
            headers: {
              'content-type': 'application/json',
              'accept': 'application/json',
              'authorization': 'Bearer $accessToken',
            },
            body: jsonEncode({
              'assetCode': assetCode,
              'destinationAddress': destinationAddress,
              'amount': amount,
              'idempotencyKey': idempotencyKey,
              if (fromAddress != null && fromAddress.isNotEmpty) 'fromAddress': fromAddress,
              'networkEnv': AuvoraNetworkEnv.current.name,
              if (qaNotionalUsdCents != null && qaNotionalUsdCents > 0)
                'qaNotionalUsdCents': '$qaNotionalUsdCents',
            }),
          )
          .timeout(timeout);
      Map<String, dynamic> body;
      try {
        final decoded = jsonDecode(res.body);
        body = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
      } catch (_) {
        body = <String, dynamic>{};
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final data = body['data'];
        return TransferPrepareResult.fromJson(
          data is Map<String, dynamic> ? data : body,
        );
      }
      if (res.statusCode == 401) {
        throw const AuthException(
          AuthErrorKind.invalidCredentials,
          WalletSessionRestore.sessionExpiredMessage,
        );
      }
      if (res.statusCode == 403) {
        throw const AuthException(
          AuthErrorKind.forbidden,
          'This transfer could not be prepared. Nothing was signed.',
        );
      }
      throw const AuthException(
        AuthErrorKind.server,
        'Transfer review could not be checked. Nothing was signed.',
      );
    } on TimeoutException {
      throw const AuthException(
        AuthErrorKind.timeout,
        'Transfer review timed out. Nothing was signed.',
      );
    } on AuthException {
      rethrow;
    } catch (error) {
      throw AuvoraConnectivity.fromTransportOrUnknown(error);
    }
  }

  Future<TransferPrepareResult> getReview({
    required String accessToken,
    required String reviewId,
  }) async {
    if (!isConfigured) {
      throw const AuthException(
        AuthErrorKind.notConfigured,
        'Account backend is not configured for this build.',
      );
    }
    try {
      final res = await _http
          .get(
            Uri.parse(
              '${_baseUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1/wallets/transfers/reviews/${Uri.encodeComponent(reviewId)}',
            ),
            headers: {
              'accept': 'application/json',
              'authorization': 'Bearer $accessToken',
            },
          )
          .timeout(timeout);
      Map<String, dynamic> body;
      try {
        final decoded = jsonDecode(res.body);
        body = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
      } catch (_) {
        body = <String, dynamic>{};
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final data = body['data'];
        return TransferPrepareResult.fromJson(
          data is Map<String, dynamic> ? data : body,
        );
      }
      throw const AuthException(
        AuthErrorKind.server,
        'Transfer review could not be loaded.',
      );
    } on AuthException {
      rethrow;
    } catch (error) {
      throw AuvoraConnectivity.fromTransportOrUnknown(error);
    }
  }
}
