import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../preferences/preferences_controller.dart';
import '../security/security_controller.dart';

/// Clipboard helper that honors Closed Beta privacy prefs.
Future<void> copyTextSecure(
  BuildContext context,
  String text, {
  String label = 'Copied',
  bool sensitive = true,
}) async {
  await Clipboard.setData(ClipboardData(text: text));
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(label)));

  if (!sensitive) return;

  final prefs = context.read<PreferencesController>();
  if (!prefs.clearClipboardAfterCopy) return;

  final security = context.read<SecurityController>();
  final seconds = security.preferences.clipboardTimeoutSeconds.clamp(5, 120);

  unawaited(
    Future<void>.delayed(Duration(seconds: seconds), () async {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      if (data?.text == text) {
        await Clipboard.setData(const ClipboardData(text: ''));
      }
    }),
  );
}
