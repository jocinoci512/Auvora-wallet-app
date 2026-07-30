import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import '../portfolio/models.dart';
import '../theme/aether_theme.dart';
import '../transfer/address_validation.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key, this.expectedNetwork});

  final AssetNetwork? expectedNetwork;

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  late final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
    torchEnabled: false,
  );
  bool _handled = false;
  String? _error;
  bool _torch = false;
  bool _permissionDenied = false;

  @override
  void initState() {
    super.initState();
    _ensurePermission();
  }

  Future<void> _ensurePermission() async {
    final status = await Permission.camera.request();
    if (!mounted) return;
    if (!status.isGranted) {
      setState(() {
        _permissionDenied = true;
        _error = 'Camera access is needed to scan. Enable it in Settings, then return here.';
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled || _permissionDenied) return;
    final raw = capture.barcodes
        .map((b) => b.rawValue)
        .whereType<String>()
        .map((s) => s.trim())
        .firstWhere((s) => s.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return;

    final parsed = AddressValidation.parsePaymentUri(raw);
    var address = parsed.address;

    if (widget.expectedNetwork != null) {
      final v = AddressValidation.validate(raw, expected: widget.expectedNetwork!);
      if (!v.ok) {
        HapticFeedback.heavyImpact();
        setState(() => _error = v.message);
        // Allow another attempt after brief cooldown
        Future<void>.delayed(const Duration(milliseconds: 1600), () {
          if (mounted && !_handled) setState(() => _error = null);
        });
        return;
      }
      address = v.normalized ?? address;
    } else if (AddressValidation.detectNetwork(address) == null) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'That QR doesn’t contain a wallet address we recognize.');
      Future<void>.delayed(const Duration(milliseconds: 1600), () {
        if (mounted && !_handled) setState(() => _error = null);
      });
      return;
    }

    _handled = true;
    HapticFeedback.mediumImpact();
    // Return raw URI so send flow can pick up embedded amount.
    Navigator.of(context).pop(raw);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan address'),
        actions: [
          IconButton(
            tooltip: _torch ? 'Torch off' : 'Torch on',
            onPressed: _permissionDenied
                ? null
                : () async {
                    await _controller.toggleTorch();
                    setState(() => _torch = !_torch);
                  },
            icon: Icon(_torch ? Icons.flash_on_rounded : Icons.flash_off_rounded),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (!_permissionDenied)
            MobileScanner(controller: _controller, onDetect: _onDetect)
          else
            const ColoredBox(color: Colors.black),
          IgnorePointer(
            child: Center(
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white70, width: 2),
                  borderRadius: BorderRadius.circular(24),
                ),
              ),
            ),
          ),
          Positioned(
            left: 24,
            right: 24,
            bottom: 40,
            child: Column(
              children: [
                if (_error != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: AetherColors.danger.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(_error!, style: const TextStyle(color: Colors.white, height: 1.4)),
                  ),
                Text(
                  widget.expectedNetwork == null
                      ? 'Point at a wallet QR. We’ll read it automatically.'
                      : 'Scanning for a ${widget.expectedNetwork!.label} address.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, height: 1.4),
                ),
                if (_permissionDenied) ...[
                  const SizedBox(height: 12),
                  const FilledButton(
                    onPressed: openAppSettings,
                    child: Text('Open Settings'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
