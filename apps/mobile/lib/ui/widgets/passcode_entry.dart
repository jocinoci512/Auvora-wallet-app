import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/aether_theme.dart';

/// Premium 6-digit passcode entry with large touch targets and haptics.
class PasscodeEntry extends StatefulWidget {
  const PasscodeEntry({
    super.key,
    required this.onCompleted,
    this.titleHint,
    this.errorText,
    this.enabled = true,
  });

  final ValueChanged<String> onCompleted;
  final String? titleHint;
  final String? errorText;
  final bool enabled;

  @override
  State<PasscodeEntry> createState() => _PasscodeEntryState();
}

class _PasscodeEntryState extends State<PasscodeEntry> {
  String _value = '';

  void _append(String d) {
    if (!widget.enabled || _value.length >= 6) return;
    HapticFeedback.selectionClick();
    setState(() => _value += d);
    if (_value.length == 6) {
      widget.onCompleted(_value);
    }
  }

  void _backspace() {
    if (!widget.enabled || _value.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() => _value = _value.substring(0, _value.length - 1));
  }

  @override
  void didUpdateWidget(covariant PasscodeEntry oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.errorText != null && widget.errorText != oldWidget.errorText && widget.errorText!.isNotEmpty) {
      setState(() => _value = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Six digit passcode',
      child: Column(
        children: [
          if (widget.titleHint != null) ...[
            Text(
              widget.titleHint!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AetherColors.muted, height: 1.4),
            ),
            const SizedBox(height: 20),
          ],
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(6, (i) {
              final filled = i < _value.length;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                curve: Curves.easeOut,
                margin: const EdgeInsets.symmetric(horizontal: 6),
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: filled ? AetherColors.lagoon : Colors.transparent,
                  border: Border.all(
                    color: filled ? AetherColors.lagoon : AetherColors.border,
                    width: 2,
                  ),
                ),
              );
            }),
          ),
          if (widget.errorText != null && widget.errorText!.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              widget.errorText!,
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.w600),
            ),
          ],
          const SizedBox(height: 28),
          _Keypad(onDigit: _append, onBackspace: _backspace, enabled: widget.enabled),
        ],
      ),
    );
  }
}

class _Keypad extends StatelessWidget {
  const _Keypad({required this.onDigit, required this.onBackspace, required this.enabled});

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '⌫'],
    ];
    return Column(
      children: keys.map((row) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: row.map((k) {
              if (k.isEmpty) return const SizedBox(width: 72, height: 72);
              return SizedBox(
                width: 72,
                height: 72,
                child: Material(
                  color: Theme.of(context).cardTheme.color,
                  shape: const CircleBorder(
                    side: BorderSide(color: AetherColors.border),
                  ),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: !enabled
                        ? null
                        : () {
                            if (k == '⌫') {
                              onBackspace();
                            } else {
                              onDigit(k);
                            }
                          },
                    child: Center(
                      child: Text(
                        k,
                        style: TextStyle(
                          fontSize: k == '⌫' ? 22 : 26,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        );
      }).toList(),
    );
  }
}
