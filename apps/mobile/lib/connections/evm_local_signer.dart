/// Local EVM signing for WalletConnect requests.
///
/// Keys stay on-device. Never log private keys, mnemonics, or raw signatures'
/// key material. Broadcast is **not** performed here — callers must respect
/// [ReleaseConfig.liveBroadcastEnabled].
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:convert/convert.dart';
import 'package:eth_sig_util/eth_sig_util.dart';
import 'package:web3dart/web3dart.dart';

import '../crypto/hd_derivation.dart';
import '../portfolio/models.dart';
import '../release/release_config.dart';

class EvmLocalSigner {
  const EvmLocalSigner();

  EthPrivateKey credentialsFromMnemonic(
    String mnemonic, {
    int accountIndex = 0,
  }) {
    final keyBytes = HdDerivation.deriveEvmPrivateKey(
      mnemonic: mnemonic,
      accountIndex: accountIndex,
    );
    return EthPrivateKey(keyBytes);
  }

  String addressFromMnemonic(String mnemonic, {int accountIndex = 0}) {
    return HdDerivation.deriveAddress(
      mnemonic: mnemonic,
      network: AssetNetwork.ethereum,
      accountIndex: accountIndex,
    );
  }

  /// EIP-191 personal_sign.
  String personalSign({
    required String mnemonic,
    required String message,
    int accountIndex = 0,
  }) {
    final credentials = credentialsFromMnemonic(mnemonic, accountIndex: accountIndex);
    final payload = _messageBytes(message);
    final sig = credentials.signPersonalMessageToUint8List(payload);
    return _hex0x(sig);
  }

  /// EIP-712 typed data v4.
  String signTypedDataV4({
    required String mnemonic,
    required String typedDataJson,
    int accountIndex = 0,
  }) {
    final keyBytes = HdDerivation.deriveEvmPrivateKey(
      mnemonic: mnemonic,
      accountIndex: accountIndex,
    );
    final privateKeyHex = hex.encode(keyBytes);
    return EthSigUtil.signTypedData(
      privateKey: privateKeyHex,
      jsonData: typedDataJson,
      version: TypedDataVersion.V4,
    );
  }

  /// Parse + validate eth_sendTransaction. Never broadcasts when kill switch is off.
  EvmSendTransactionPreview previewSendTransaction(Map<String, dynamic> tx) {
    final from = (tx['from'] ?? '').toString();
    final to = (tx['to'] ?? '').toString();
    final valueHex = (tx['value'] ?? '0x0').toString();
    final data = (tx['data'] ?? '0x').toString();
    final valueWei = _parseHexBigInt(valueHex);
    final hasContractData = data.length > 2 && data != '0x' && data != '0x0';
    return EvmSendTransactionPreview(
      from: from,
      to: to.isEmpty ? '(contract create)' : to,
      valueWei: valueWei,
      valueEthLabel: _formatEth(valueWei),
      data: data,
      hasContractInteraction: hasContractData,
      gas: (tx['gas'] ?? tx['gasLimit'])?.toString(),
      maxFeePerGas: tx['maxFeePerGas']?.toString(),
      maxPriorityFeePerGas: tx['maxPriorityFeePerGas']?.toString(),
      gasPrice: tx['gasPrice']?.toString(),
    );
  }

  /// Controlled refusal when live broadcast is disabled.
  Never refuseBroadcast() {
    throw const WcBroadcastDisabledException(
      'Live transaction broadcast is disabled '
      '(ReleaseConfig.liveBroadcastEnabled=${ReleaseConfig.liveBroadcastEnabled}). '
      'WalletConnect cannot bypass this kill switch.',
    );
  }

  /// Attempt send — always blocked while kill switch is false.
  String sendTransactionOrRefuse({
    required Map<String, dynamic> tx,
  }) {
    // Always preview-parse first so callers can show human-readable details.
    previewSendTransaction(tx);
    if (!ReleaseConfig.liveBroadcastEnabled) {
      refuseBroadcast();
    }
    // Live path reserved for a future audited broadcast adapter.
    refuseBroadcast();
  }

  Uint8List _messageBytes(String message) {
    final trimmed = message.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      try {
        final hexBody = trimmed.substring(2);
        if (hexBody.isEmpty) return Uint8List(0);
        return Uint8List.fromList(hex.decode(hexBody));
      } catch (_) {
        // Fall through to UTF-8.
      }
    }
    return Uint8List.fromList(utf8.encode(message));
  }

  BigInt _parseHexBigInt(String raw) {
    final t = raw.trim();
    if (t.isEmpty || t == '0x' || t == '0X') return BigInt.zero;
    if (t.startsWith('0x') || t.startsWith('0X')) {
      return BigInt.parse(t.substring(2), radix: 16);
    }
    return BigInt.tryParse(t) ?? BigInt.zero;
  }

  String _formatEth(BigInt wei) {
    if (wei == BigInt.zero) return '0 ETH';
    final eth = wei / BigInt.from(10).pow(18);
    final rem = wei % BigInt.from(10).pow(18);
    if (rem == BigInt.zero) return '$eth ETH';
    final frac = rem.toString().padLeft(18, '0').replaceFirst(RegExp(r'0+$'), '');
    return '$eth.${frac.isEmpty ? '0' : frac} ETH';
  }

  String _hex0x(Uint8List bytes) => '0x${hex.encode(bytes)}';
}

class EvmSendTransactionPreview {
  const EvmSendTransactionPreview({
    required this.from,
    required this.to,
    required this.valueWei,
    required this.valueEthLabel,
    required this.data,
    required this.hasContractInteraction,
    this.gas,
    this.maxFeePerGas,
    this.maxPriorityFeePerGas,
    this.gasPrice,
  });

  final String from;
  final String to;
  final BigInt valueWei;
  final String valueEthLabel;
  final String data;
  final bool hasContractInteraction;
  final String? gas;
  final String? maxFeePerGas;
  final String? maxPriorityFeePerGas;
  final String? gasPrice;

  String get humanSummary {
    final parts = <String>[
      'From $from',
      'To $to',
      'Value $valueEthLabel',
      if (hasContractInteraction) 'Includes contract calldata — review carefully',
      if (gas != null) 'Gas $gas',
    ];
    return parts.join(' · ');
  }
}

class WcBroadcastDisabledException implements Exception {
  const WcBroadcastDisabledException(this.message);
  final String message;

  @override
  String toString() => message;
}
