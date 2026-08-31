import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Regression: disposing TextEditingController after showDialog returns while the
/// dialog TextField still has InheritedWidget dependents triggers:
/// '_dependents.isEmpty': is not true.
///
/// Secure backup must own the controller inside a StatefulWidget dialog and
/// only dispose it from State.dispose after unmount.
void main() {
  testWidgets('password dialog StatefulWidget disposes controller after unmount', (tester) async {
    final owned = <TextEditingController>[];

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: Center(
                child: FilledButton(
                  onPressed: () async {
                    await showDialog<bool>(
                      context: context,
                      builder: (_) => _LifecycleOwnedPasswordDialog(owned: owned),
                    );
                  },
                  child: const Text('Open'),
                ),
              ),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget);
    expect(owned, hasLength(1));

    await tester.enterText(find.byType(TextField), 'CorrectHorseBattery!');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNothing);
    // Controller still valid through dispose path (no early dispose before pop).
    expect(() => owned.single.text, returnsNormally);
  });

  testWidgets('double Continue while busy only starts one job', (tester) async {
    var jobs = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: Center(
                child: FilledButton(
                  onPressed: () {
                    showDialog<void>(
                      context: context,
                      barrierDismissible: false,
                      builder: (_) => _BusyGuardDialog(
                        onJob: () async {
                          jobs += 1;
                          await Future<void>.delayed(const Duration(milliseconds: 80));
                        },
                      ),
                    );
                  },
                  child: const Text('Open'),
                ),
              ),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'CorrectHorseBattery!');
    await tester.tap(find.text('Continue'));
    await tester.pump(); // start async job; button disables / relabels
    expect(find.text('Please wait…'), findsOneWidget);
    // Second activation while busy must be a no-op (button onPressed is null).
    final busyButton = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Please wait…'));
    expect(busyButton.onPressed, isNull);
    await tester.pumpAndSettle();
    expect(jobs, 1);
  });
}

class _LifecycleOwnedPasswordDialog extends StatefulWidget {
  const _LifecycleOwnedPasswordDialog({required this.owned});
  final List<TextEditingController> owned;

  @override
  State<_LifecycleOwnedPasswordDialog> createState() => _LifecycleOwnedPasswordDialogState();
}

class _LifecycleOwnedPasswordDialogState extends State<_LifecycleOwnedPasswordDialog> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController();
    widget.owned.add(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Finish secure backup'),
      content: TextField(controller: _ctrl, obscureText: true),
      actions: [
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Continue'),
        ),
      ],
    );
  }
}

class _BusyGuardDialog extends StatefulWidget {
  const _BusyGuardDialog({required this.onJob});
  final Future<void> Function() onJob;

  @override
  State<_BusyGuardDialog> createState() => _BusyGuardDialogState();
}

class _BusyGuardDialogState extends State<_BusyGuardDialog> {
  final _ctrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    await widget.onJob();
    if (!mounted) return;
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      content: TextField(controller: _ctrl, enabled: !_submitting),
      actions: [
        FilledButton(
          onPressed: _submitting ? null : _continue,
          child: Text(_submitting ? 'Please wait…' : 'Continue'),
        ),
      ],
    );
  }
}
