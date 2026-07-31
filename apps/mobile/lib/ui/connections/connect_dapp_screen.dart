import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../connections/connections_controller.dart';
import '../../connections/models.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import 'connection_approval_sheet.dart';

class ConnectDappScreen extends StatefulWidget {
  const ConnectDappScreen({super.key, this.initialUri});

  final String? initialUri;

  @override
  State<ConnectDappScreen> createState() => _ConnectDappScreenState();
}

class _ConnectDappScreenState extends State<ConnectDappScreen> {
  final _uriCtrl = TextEditingController();
  final _pairCtrl = TextEditingController();
  String? _error;
  bool _busy = false;
  bool _scanning = false;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialUri?.trim();
    if (initial != null && initial.isNotEmpty) {
      _uriCtrl.text = initial;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final method = initial.toLowerCase().startsWith('wc:')
            ? ConnectionMethod.walletConnectUri
            : ConnectionMethod.deepLink;
        // ignore: discarded_futures
        _submit(initial, method);
      });
    }
  }

  @override
  void dispose() {
    _uriCtrl.dispose();
    _pairCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit(String raw, ConnectionMethod method) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final connections = context.read<ConnectionsController>();
      final wallet = context.read<WalletController>();
      final request = await connections.createPairingRequest(
        rawInput: raw,
        method: method,
        account: wallet.address,
      );
      if (!mounted) return;
      final approved = await showConnectionApprovalSheet(context, request: request);
      if (!mounted) return;
      if (approved == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connection approved (preview session)')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      setState(() => _error = e is ArgumentError
          ? (e.message?.toString() ?? 'Invalid pairing input.')
          : 'Could not start pairing. Check the URI or code and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _scanQr() async {
    final status = await Permission.camera.request();
    if (!status.isGranted) {
      setState(() => _error = 'Camera access is needed to scan a WalletConnect QR.');
      return;
    }
    if (!mounted) return;
    setState(() => _scanning = true);
    final raw = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _WcQrScannerPage()),
    );
    if (!mounted) return;
    setState(() => _scanning = false);
    if (raw == null || raw.trim().isEmpty) return;
    await _submit(raw.trim(), ConnectionMethod.qr);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Connect an app')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          Text('Pair safely', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 6),
          const Text(
            'Scan a QR, paste a WalletConnect-shaped URI, or enter a desktop pairing code. Every connection still needs your approval.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 12),
          const Text(
            'Preview pairing — sessions are stored on this device and are not a live WalletConnect relay.',
            style: TextStyle(color: AetherColors.muted, height: 1.4, fontSize: 13),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _busy || _scanning ? null : _scanQr,
            icon: const Icon(Icons.qr_code_scanner_rounded),
            label: Text(_scanning ? 'Opening camera…' : 'Scan QR code'),
          ),
          const SizedBox(height: 24),
          Text('Paste connection URI', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          TextField(
            controller: _uriCtrl,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'wc:… or https://app.example.com',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: _busy
                ? null
                : () => _submit(_uriCtrl.text, ConnectionMethod.walletConnectUri),
            child: const Text('Review connection'),
          ),
          const SizedBox(height: 24),
          Text('Desktop pairing code', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          TextField(
            controller: _pairCtrl,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(
              hintText: 'AUVR-7K2M',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: _busy
                ? null
                : () => _submit(_pairCtrl.text, ConnectionMethod.desktopPairing),
            child: const Text('Pair with desktop'),
          ),
          TextButton(
            onPressed: _busy
                ? null
                : () {
                    _pairCtrl.text = 'AUVR-7K2M';
                    setState(() {});
                  },
            child: const Text('Use sample pair code'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _busy
                ? null
                : () => _submit(
                      'wc:uniswap@2?relay=preview#https://app.uniswap.org',
                      ConnectionMethod.walletConnectUri,
                    ),
            child: const Text('Try sample Uniswap pairing'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      ),
    );
  }
}

class _WcQrScannerPage extends StatefulWidget {
  const _WcQrScannerPage();

  @override
  State<_WcQrScannerPage> createState() => _WcQrScannerPageState();
}

class _WcQrScannerPageState extends State<_WcQrScannerPage> {
  late final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final raw = capture.barcodes
        .map((b) => b.rawValue)
        .whereType<String>()
        .map((s) => s.trim())
        .firstWhere((s) => s.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return;
    final lower = raw.toLowerCase();
    final looksLikeWc = lower.startsWith('wc:');
    final looksLikeUrl = lower.startsWith('http://') || lower.startsWith('https://');
    final looksLikeCode = RegExp(r'^[A-Z0-9-]{6,32}$', caseSensitive: false).hasMatch(raw);
    if (!looksLikeWc && !looksLikeUrl && !looksLikeCode) {
      // Keep scanning for a recognizable pairing payload.
      return;
    }
    _handled = true;
    HapticFeedback.selectionClick();
    Navigator.pop(context, raw);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan WalletConnect QR')),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          const Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Point at a WalletConnect QR (wc:), HTTPS origin, or pairing code.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, height: 1.4),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
