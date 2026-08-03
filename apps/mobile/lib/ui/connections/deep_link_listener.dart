import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../connections/connections_controller.dart';
import '../../connections/deep_link_router.dart';
import '../../connections/wallet_connect_provider.dart';
import '../../state/wallet_controller.dart';
import 'connect_dapp_screen.dart';
import 'connection_approval_sheet.dart';

/// Listens for OS deep links and routes WalletConnect / auth / tx URIs safely.
class DeepLinkListener extends StatefulWidget {
  const DeepLinkListener({required this.child, super.key});

  final Widget child;

  @override
  State<DeepLinkListener> createState() => _DeepLinkListenerState();
}

class _DeepLinkListenerState extends State<DeepLinkListener> {
  StreamSubscription<Uri>? _sub;
  final AppLinks _appLinks = AppLinks();
  bool _handledInitial = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    if (!mounted) return;
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) await _onUri(initial);
    } catch (_) {
      // Platform may not support deep links (e.g. some desktop targets).
    }
    _sub = _appLinks.uriLinkStream.listen((uri) {
      // ignore: discarded_futures
      _onUri(uri);
    }, onError: (_) {});
    _handledInitial = true;
  }

  Future<void> _onUri(Uri uri) async {
    if (!mounted) return;
    final router = context.read<DeepLinkRouter>();
    final connections = context.read<ConnectionsController>();
    final wallet = context.read<WalletController>();
    final validation = router.ingest(uri.toString());

    if (!validation.valid) {
      if (!mounted) return;
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(content: Text(validation.message ?? 'Unsupported or invalid link.')),
      );
      return;
    }

    if (validation.kind == DeepLinkKind.transactionRequest ||
        validation.kind == DeepLinkKind.authentication) {
      await connections.handleInboundDeepLink(uri.toString());
      if (!mounted) return;
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(
          content: Text(
            validation.message ??
                'This link needs a manual review — open Signing or Permission Center.',
          ),
        ),
      );
      return;
    }

    if (validation.kind == DeepLinkKind.companionPair) {
      if (!mounted) return;
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(
          content: Text(
            validation.message ??
                'Companion link received — paste a WalletConnect URI to continue.',
          ),
        ),
      );
      if (wallet.unlocked && wallet.stage == AppStage.dashboard) {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const ConnectDappScreen()),
        );
      }
      return;
    }

    if (!wallet.unlocked || wallet.stage != AppStage.dashboard) {
      // Queue until the user unlocks; Connect screen can consume pending URI.
      return;
    }

    final request = await connections.handleInboundDeepLink(uri.toString());
    if (!mounted || request == null) return;
    await showConnectionApprovalSheet(context, request: request);
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // When unlocked, surface any pending deep link once.
    final wallet = context.watch<WalletController>();
    final router = context.watch<DeepLinkRouter>();
    if (_handledInitial &&
        wallet.unlocked &&
        wallet.stage == AppStage.dashboard &&
        router.pendingUri != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        final pending = router.takePending();
        if (pending == null) return;
        final connections = context.read<ConnectionsController>();
        final nav = Navigator.of(context);
        try {
          final request = await connections.handleInboundDeepLink(pending);
          if (!mounted || request == null) return;
          if (!context.mounted) return;
          await showConnectionApprovalSheet(context, request: request);
        } catch (_) {
          if (!mounted) return;
          nav.push(
            MaterialPageRoute<void>(
              builder: (_) => ConnectDappScreen(initialUri: pending),
            ),
          );
        }
      });
    }
    return widget.child;
  }
}
