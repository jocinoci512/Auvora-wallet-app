import 'package:flutter/material.dart';

import '../../intelligence/models.dart';
import '../../theme/aether_theme.dart';

/// Compact, dismissible guidance — structured for screen readers.
class IntelligenceTipCard extends StatelessWidget {
  const IntelligenceTipCard({
    super.key,
    required this.title,
    required this.body,
    this.onDismiss,
    this.onLearnMore,
    this.semanticLabel,
  });

  final String title;
  final String body;
  final VoidCallback? onDismiss;
  final VoidCallback? onLearnMore;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: semanticLabel ?? 'Guidance: $title. $body',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
        decoration: BoxDecoration(
          color: AetherColors.lagoon.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.3)),
                  const SizedBox(height: 4),
                  Text(body, style: const TextStyle(height: 1.4, fontSize: 13, color: AetherColors.muted)),
                  if (onLearnMore != null)
                    TextButton(
                      onPressed: onLearnMore,
                      style: TextButton.styleFrom(
                        minimumSize: const Size(48, 48),
                        padding: const EdgeInsets.only(top: 4),
                      ),
                      child: const Text('Related lesson'),
                    ),
                ],
              ),
            ),
            if (onDismiss != null)
              IconButton(
                tooltip: 'Dismiss tip',
                onPressed: onDismiss,
                icon: const Icon(Icons.close_rounded),
                style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
              ),
          ],
        ),
      ),
    );
  }
}

class IntelligenceExplainPanel extends StatelessWidget {
  const IntelligenceExplainPanel({
    super.key,
    required this.explanation,
    this.onLearnMore,
    this.compact = false,
  });

  final IntelligenceExplanation explanation;
  final VoidCallback? onLearnMore;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      header: true,
      label: 'Guidance: ${explanation.title}',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AetherColors.lagoon.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AetherColors.lagoon.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              explanation.title,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 6),
            if (compact) ...[
              Text(
                '${explanation.whatHappened} ${explanation.whatYouCanDo}',
                style: const TextStyle(height: 1.4, fontSize: 13, color: AetherColors.muted),
              ),
            ] else ...[
              Text(explanation.whatHappened, style: const TextStyle(height: 1.4)),
              const SizedBox(height: 8),
              const Text('Why it matters', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              Text(
                explanation.whyItMatters,
                style: const TextStyle(height: 1.4, color: AetherColors.muted),
              ),
              const SizedBox(height: 8),
              const Text('What you can do', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              Text(
                explanation.whatYouCanDo,
                style: const TextStyle(height: 1.4, color: AetherColors.muted),
              ),
            ],
            if (onLearnMore != null) ...[
              const SizedBox(height: 4),
              TextButton(
                onPressed: onLearnMore,
                style: TextButton.styleFrom(minimumSize: const Size(48, 40)),
                child: const Text('Related lesson'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
