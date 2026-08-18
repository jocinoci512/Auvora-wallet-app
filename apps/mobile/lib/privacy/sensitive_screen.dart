import 'package:flutter/widgets.dart';

import 'screenshot_guard.dart';

/// Enables Android FLAG_SECURE while this route is visible (recovery phrase,
/// import, verify). Restores the previous global preference on dispose.
class SensitiveScope extends StatefulWidget {
  const SensitiveScope({
    super.key,
    required this.child,
    this.keepEnabledOnExit = false,
  });

  final Widget child;

  /// When true (user enabled screenshot protection globally), do not clear
  /// FLAG_SECURE when leaving this screen.
  final bool keepEnabledOnExit;

  @override
  State<SensitiveScope> createState() => _SensitiveScopeState();
}

class _SensitiveScopeState extends State<SensitiveScope> {
  @override
  void initState() {
    super.initState();
    ScreenshotGuard.setEnabled(true);
  }

  @override
  void dispose() {
    if (!widget.keepEnabledOnExit) {
      ScreenshotGuard.setEnabled(false);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
