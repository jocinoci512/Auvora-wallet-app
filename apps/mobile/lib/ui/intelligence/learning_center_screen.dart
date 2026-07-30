import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../intelligence/catalog.dart';
import '../../intelligence/intelligence_controller.dart';
import '../../theme/aether_theme.dart';

class LearningCenterScreen extends StatefulWidget {
  const LearningCenterScreen({super.key, this.initialLessonId});

  final String? initialLessonId;

  @override
  State<LearningCenterScreen> createState() => _LearningCenterScreenState();
}

class _LearningCenterScreenState extends State<LearningCenterScreen> {
  String _query = '';
  String? _activeId;

  @override
  void initState() {
    super.initState();
    _activeId = widget.initialLessonId;
  }

  @override
  Widget build(BuildContext context) {
    final intel = context.watch<IntelligenceController>();
    final lessons = intel.lessons(query: _query);
    final categories = <String>{for (final l in IntelligenceCatalog.learnLessons) l.category}.toList()
      ..sort();
    final active = _activeId == null ? null : IntelligenceCatalog.lessonById(_activeId!);

    return Scaffold(
      appBar: AppBar(
        title: Text(active == null ? 'Learning Center' : active.title),
        leading: active != null
            ? IconButton(
                tooltip: 'All lessons',
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => setState(() => _activeId = null),
              )
            : null,
      ),
      body: active != null
          ? ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                Text(
                  '${active.category} · about ${active.minutes} min',
                  style: const TextStyle(color: AetherColors.muted),
                ),
                const SizedBox(height: 8),
                Text(active.title, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 12),
                for (final p in active.body) ...[
                  Text(p, style: const TextStyle(height: 1.5)),
                  const SizedBox(height: 12),
                ],
                const Text(
                  IntelligenceCatalog.disclaimer,
                  style: TextStyle(color: AetherColors.muted, height: 1.4, fontSize: 13),
                ),
              ],
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                const Text(
                  'Short lessons in plain language. They educate — they never tell you what to buy or sell.',
                  style: TextStyle(color: AetherColors.muted, height: 1.45),
                ),
                const SizedBox(height: 12),
                TextField(
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Fees, recovery, bridges…',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (v) => setState(() => _query = v),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final c in categories)
                      ActionChip(
                        label: Text(c),
                        onPressed: () => setState(() => _query = c),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                if (lessons.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: Text('No lessons match. Try another word.'),
                  )
                else
                  for (final lesson in lessons)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(lesson.title),
                      subtitle: Text(
                        '${lesson.category} · ${lesson.minutes} min — ${lesson.summary}',
                        style: const TextStyle(height: 1.35),
                      ),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => setState(() => _activeId = lesson.id),
                    ),
              ],
            ),
    );
  }
}

Future<void> openLesson(BuildContext context, String? lessonId) async {
  if (lessonId == null) {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const LearningCenterScreen()),
    );
    return;
  }
  await Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => LearningCenterScreen(initialLessonId: lessonId),
    ),
  );
}
