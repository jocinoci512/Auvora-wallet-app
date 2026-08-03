/// Parse WalletConnect session-request payloads into human-readable summaries.
library;

import 'dart:convert';

import 'evm_local_signer.dart';
import 'wc_chain_catalog.dart';

enum WcRequestKind {
  personalSign,
  signTypedDataV4,
  sendTransaction,
  unsupported,
  unsafeRejected,
}

class ParsedWcRequest {
  const ParsedWcRequest({
    required this.kind,
    required this.method,
    required this.chainId,
    required this.networkLabel,
    required this.summary,
    required this.canMoveFunds,
    this.fromAddress,
    this.messagePreview,
    this.typedDataPreview,
    this.txPreview,
    this.rejectReason,
  });

  final WcRequestKind kind;
  final String method;
  final String chainId;
  final String networkLabel;
  final String summary;
  final bool canMoveFunds;
  final String? fromAddress;
  final String? messagePreview;
  final String? typedDataPreview;
  final EvmSendTransactionPreview? txPreview;
  final String? rejectReason;
}

abstract final class WcRequestParser {
  static const _signer = EvmLocalSigner();

  static ParsedWcRequest parse({
    required String method,
    required String chainId,
    required dynamic params,
  }) {
    final networkLabel = WcChainCatalog.labelForCaip(chainId);

    if (WcChainCatalog.isUnsafeRejectedMethod(method)) {
      return ParsedWcRequest(
        kind: WcRequestKind.unsafeRejected,
        method: method,
        chainId: chainId,
        networkLabel: networkLabel,
        summary: '$method is not supported (unsafe raw eth_sign).',
        canMoveFunds: true,
        rejectReason: 'Auvora rejects eth_sign. Use personal_sign or eth_signTypedData_v4.',
      );
    }

    if (!WcChainCatalog.isSupportedCaip(chainId)) {
      return ParsedWcRequest(
        kind: WcRequestKind.unsupported,
        method: method,
        chainId: chainId,
        networkLabel: networkLabel,
        summary: 'Unsupported chain $chainId',
        canMoveFunds: false,
        rejectReason: 'Chain $chainId is not supported for WalletConnect in Auvora.',
      );
    }

    if (!WcChainCatalog.isSupportedMethod(method)) {
      return ParsedWcRequest(
        kind: WcRequestKind.unsupported,
        method: method,
        chainId: chainId,
        networkLabel: networkLabel,
        summary: 'Unsupported method $method',
        canMoveFunds: false,
        rejectReason: 'Method $method is not supported.',
      );
    }

    switch (method) {
      case 'personal_sign':
        return _parsePersonalSign(method, chainId, networkLabel, params);
      case 'eth_signTypedData_v4':
        return _parseTypedData(method, chainId, networkLabel, params);
      case 'eth_sendTransaction':
        return _parseSendTx(method, chainId, networkLabel, params);
      default:
        return ParsedWcRequest(
          kind: WcRequestKind.unsupported,
          method: method,
          chainId: chainId,
          networkLabel: networkLabel,
          summary: 'Unsupported method $method',
          canMoveFunds: false,
          rejectReason: 'Method $method is not supported.',
        );
    }
  }

  static ParsedWcRequest _parsePersonalSign(
    String method,
    String chainId,
    String networkLabel,
    dynamic params,
  ) {
    final list = params is List ? params : const [];
    // personal_sign params: [message, address] or [address, message]
    String? address;
    String message = '';
    if (list.length >= 2) {
      final a = list[0].toString();
      final b = list[1].toString();
      if (a.toLowerCase().startsWith('0x') && a.length == 42) {
        address = a;
        message = b;
      } else if (b.toLowerCase().startsWith('0x') && b.length == 42) {
        address = b;
        message = a;
      } else {
        message = a;
        address = b;
      }
    } else if (list.isNotEmpty) {
      message = list.first.toString();
    }
    final preview = _utf8Preview(message);
    return ParsedWcRequest(
      kind: WcRequestKind.personalSign,
      method: method,
      chainId: chainId,
      networkLabel: networkLabel,
      summary: 'personal_sign · $preview',
      canMoveFunds: false,
      fromAddress: address,
      messagePreview: preview,
    );
  }

  static ParsedWcRequest _parseTypedData(
    String method,
    String chainId,
    String networkLabel,
    dynamic params,
  ) {
    final list = params is List ? params : const [];
    String? address;
    String jsonData = '';
    if (list.length >= 2) {
      address = list[0].toString();
      final raw = list[1];
      jsonData = raw is String ? raw : jsonEncode(raw);
    }
    String preview = jsonData;
    try {
      final map = jsonDecode(jsonData) as Map<String, dynamic>;
      final primary = map['primaryType']?.toString() ?? 'TypedData';
      final domain = map['domain'] is Map ? Map<String, dynamic>.from(map['domain'] as Map) : {};
      final name = domain['name']?.toString() ?? '';
      preview = '$primary${name.isEmpty ? '' : ' · $name'}';
      if (primary.toLowerCase().contains('permit') ||
          jsonData.toLowerCase().contains('permit')) {
        preview = '$preview · may authorize token spending';
      }
    } catch (_) {
      preview = jsonData.length > 120 ? '${jsonData.substring(0, 120)}…' : jsonData;
    }
    return ParsedWcRequest(
      kind: WcRequestKind.signTypedDataV4,
      method: method,
      chainId: chainId,
      networkLabel: networkLabel,
      summary: 'eth_signTypedData_v4 · $preview',
      canMoveFunds: true,
      fromAddress: address,
      typedDataPreview: preview,
    );
  }

  static ParsedWcRequest _parseSendTx(
    String method,
    String chainId,
    String networkLabel,
    dynamic params,
  ) {
    final list = params is List ? params : const [];
    final raw = list.isNotEmpty ? list.first : params;
    final map = raw is Map
        ? Map<String, dynamic>.from(raw)
        : <String, dynamic>{};
    final preview = _signer.previewSendTransaction(map);
    return ParsedWcRequest(
      kind: WcRequestKind.sendTransaction,
      method: method,
      chainId: chainId,
      networkLabel: networkLabel,
      summary: preview.humanSummary,
      canMoveFunds: true,
      fromAddress: preview.from,
      txPreview: preview,
    );
  }

  static String _utf8Preview(String message) {
    final t = message.trim();
    if (t.startsWith('0x') || t.startsWith('0X')) {
      try {
        final bytes = t.substring(2).isEmpty
            ? <int>[]
            : List<int>.generate(
                t.substring(2).length ~/ 2,
                (i) => int.parse(t.substring(2 + i * 2, 4 + i * 2), radix: 16),
              );
        final decoded = utf8.decode(bytes, allowMalformed: true);
        if (decoded.trim().isNotEmpty && decoded.runes.every((r) => r >= 9 && r < 0xFFFE)) {
          return decoded.length > 160 ? '${decoded.substring(0, 160)}…' : decoded;
        }
      } catch (_) {}
      return t.length > 64 ? '${t.substring(0, 64)}…' : t;
    }
    return t.length > 160 ? '${t.substring(0, 160)}…' : t;
  }
}
