import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auvora_api_config.dart';
import 'auth_api_client.dart';
import 'auvora_connectivity.dart';

/// Safe KYC status snapshot for customer UI (no document payloads).
class KycStatusSnapshot {
  const KycStatusSnapshot({
    required this.status,
    required this.level,
    this.productLabel = 'Not verified',
    this.needsResubmission = false,
    this.isApproved = false,
    this.customerReason,
  });

  final String status;
  final String level;
  final String productLabel;
  final bool needsResubmission;
  final bool isApproved;
  final String? customerReason;

  factory KycStatusSnapshot.fromJson(Map<String, dynamic> json) {
    final status = (json['status'] ?? 'DRAFT').toString().toUpperCase();
    final level = (json['level'] ?? 'NONE').toString();
    final meta = json['metadata'];
    final resubmit = meta is Map && meta['resubmissionRequired'] == true;
    final reason = (json['rejectionReason'] ??
            (meta is Map ? meta['customerVisibleReason'] : null))
        ?.toString();
    final label = switch (status) {
      'APPROVED' => 'Verified',
      'IN_REVIEW' || 'PENDING_PROVIDER' || 'SUBMITTED' => 'In review',
      'REJECTED' => resubmit || status == 'RENEWAL_REQUIRED' || status == 'REQUIRES_RESUBMISSION'
          ? 'Action required'
          : 'Rejected',
      'RENEWAL_REQUIRED' || 'REQUIRES_RESUBMISSION' => 'Action required',
      _ => 'Not verified',
    };
    return KycStatusSnapshot(
      status: status,
      level: level,
      productLabel: label,
      needsResubmission: resubmit ||
          status == 'RENEWAL_REQUIRED' ||
          status == 'REQUIRES_RESUBMISSION',
      isApproved: status == 'APPROVED',
      customerReason: reason == null || reason.isEmpty ? null : reason,
    );
  }
}

/// Customer KYC API — never uploads raw ID documents from this client path.
class KycClient {
  KycClient({
    http.Client? httpClient,
    String? baseUrl,
    this.timeout = const Duration(seconds: 20),
  })  : _http = httpClient ?? http.Client(),
        _baseUrl = (baseUrl ?? AuvoraApiConfig.baseUrl).trim();

  final http.Client _http;
  final String _baseUrl;
  final Duration timeout;

  bool get isConfigured => _baseUrl.isNotEmpty;

  Future<KycStatusSnapshot> fetchStatus({required String accessToken}) async {
    final body = await _get('/api/v1/compliance/kyc', accessToken);
    final data = body['data'];
    return KycStatusSnapshot.fromJson(
      data is Map<String, dynamic> ? data : body,
    );
  }

  /// Starts a BASIC verification request (provider may place it IN_REVIEW).
  Future<Map<String, dynamic>> submitBasic({required String accessToken}) async {
    return submitKyc(
      accessToken: accessToken,
      requestedLevel: 'BASIC',
      legalName: 'QA User',
      country: 'US',
    );
  }

  /// Submits full first-party customer KYC verification.
  Future<Map<String, dynamic>> submitKyc({
    required String accessToken,
    required String requestedLevel,
    String? legalName,
    String? country,
    String? dateOfBirth,
    String? idType,
    String? idNumber,
    String? idExpiration,
    String? frontDocumentId,
    String? backDocumentId,
  }) async {
    final payload = <String, dynamic>{
      'requestedLevel': requestedLevel,
      if (legalName != null && legalName.isNotEmpty) 'legalName': legalName,
      if (country != null && country.isNotEmpty) 'country': country,
      if (dateOfBirth != null && dateOfBirth.isNotEmpty) 'dateOfBirth': dateOfBirth,
      if (idType != null && idType.isNotEmpty) 'idType': idType,
      if (idNumber != null && idNumber.isNotEmpty) 'idNumber': idNumber,
      if (idExpiration != null && idExpiration.isNotEmpty) 'idExpiration': idExpiration,
      if (frontDocumentId != null && frontDocumentId.isNotEmpty)
        'frontDocumentId': frontDocumentId,
      if (backDocumentId != null && backDocumentId.isNotEmpty)
        'backDocumentId': backDocumentId,
    };
    return _post('/api/v1/compliance/kyc', accessToken, payload);
  }

  Future<Map<String, dynamic>> _get(String path, String accessToken) async {
    if (!isConfigured) {
      throw const AuthException(
        AuthErrorKind.notConfigured,
        'Account backend is not configured for this build.',
      );
    }
    try {
      final res = await _http
          .get(
            Uri.parse('${_baseUrl.replaceAll(RegExp(r'/+$'), '')}$path'),
            headers: {
              'accept': 'application/json',
              'authorization': 'Bearer $accessToken',
            },
          )
          .timeout(timeout);
      return _decode(res);
    } on TimeoutException {
      throw const AuthException(AuthErrorKind.timeout, 'KYC status timed out.');
    } on AuthException {
      rethrow;
    } catch (error) {
      throw AuvoraConnectivity.fromTransportOrUnknown(error);
    }
  }

  Future<Map<String, dynamic>> _post(
    String path,
    String accessToken,
    Map<String, dynamic> payload,
  ) async {
    if (!isConfigured) {
      throw const AuthException(
        AuthErrorKind.notConfigured,
        'Account backend is not configured for this build.',
      );
    }
    try {
      final res = await _http
          .post(
            Uri.parse('${_baseUrl.replaceAll(RegExp(r'/+$'), '')}$path'),
            headers: {
              'content-type': 'application/json',
              'accept': 'application/json',
              'authorization': 'Bearer $accessToken',
            },
            body: jsonEncode(payload),
          )
          .timeout(timeout);
      return _decode(res);
    } on TimeoutException {
      throw const AuthException(AuthErrorKind.timeout, 'KYC submission timed out.');
    } on AuthException {
      rethrow;
    } catch (error) {
      throw AuvoraConnectivity.fromTransportOrUnknown(error);
    }
  }

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> body;
    try {
      final decoded = jsonDecode(res.body);
      body = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } catch (_) {
      body = <String, dynamic>{};
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    if (res.statusCode == 401 || res.statusCode == 403) {
      throw const AuthException(
        AuthErrorKind.forbidden,
        'Could not access identity verification. Sign in and try again.',
      );
    }
    throw const AuthException(
      AuthErrorKind.server,
      'Identity verification could not be completed.',
    );
  }
}
