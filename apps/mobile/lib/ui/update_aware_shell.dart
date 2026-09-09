import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../release/app_update_policy.dart';
import 'app_shell.dart';
import 'update/update_gates.dart';

/// Evaluates remote/local version policy once after first frame.
class UpdateAwareShell extends StatefulWidget {
  const UpdateAwareShell({super.key});

  @override
  State<UpdateAwareShell> createState() => _UpdateAwareShellState();
}

class _UpdateAwareShellState extends State<UpdateAwareShell> {
  AppUpdateDecision? _decision;
  var _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // ignore: discarded_futures
      _load();
    });
  }

  Future<void> _load() async {
    final decision = await AppUpdatePolicyService.evaluate();
    if (!mounted) return;
    setState(() {
      _decision = decision;
      _loading = false;
    });
  }

  Future<void> _openStore(AppUpdateDecision decision) async {
    final uri = Uri.parse(decision.policy.storeUrl);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const AppShell();
    }
    final decision = _decision;
    if (decision == null) {
      return const AppShell();
    }
    if (decision.urgency == AppUpdateUrgency.required) {
      return RequiredUpdateGate(decision: decision);
    }
    if (decision.urgency == AppUpdateUrgency.optional) {
      return Column(
        children: [
          OptionalUpdateBanner(
            decision: decision,
            onLater: () async {
              await AppUpdatePolicyService.dismissOptionalNotice();
              if (!mounted) return;
              setState(() {
                _decision = AppUpdateDecision(
                  urgency: AppUpdateUrgency.none,
                  policy: decision.policy,
                  installedVersionCode: decision.installedVersionCode,
                  installedVersionName: decision.installedVersionName,
                );
              });
            },
            onUpdate: () => _openStore(decision),
          ),
          const Expanded(child: AppShell()),
        ],
      );
    }
    return const AppShell();
  }
}
