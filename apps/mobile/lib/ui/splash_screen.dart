import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _lift;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _lift = Tween(begin: 10.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final media = MediaQuery.maybeOf(context);
      final reduce = media?.disableAnimations == true;
      if (reduce) {
        _controller.value = 1;
      } else {
        _controller.forward();
      }
      context.read<WalletController>().bootstrap(systemReduceMotion: reduce);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = context.watch<WalletController>().reduceMotion;
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0B3A44), AetherColors.lagoon, Color(0xFF0A2E36)],
          ),
        ),
        child: Center(
          child: reduce
              ? const _BrandMark()
              : FadeTransition(
                  opacity: _fade,
                  child: AnimatedBuilder(
                    animation: _lift,
                    builder: (context, child) => Transform.translate(
                      offset: Offset(0, _lift.value),
                      child: child,
                    ),
                    child: const _BrandMark(),
                  ),
                ),
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return const Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Auvora',
          style: TextStyle(
            color: Colors.white,
            fontSize: 44,
            fontWeight: FontWeight.w700,
            letterSpacing: -1.4,
          ),
        ),
        SizedBox(height: 10),
        Text(
          'Quiet custody for digital value',
          style: TextStyle(color: Color(0xFFB7D7DD), fontSize: 15, height: 1.3),
        ),
      ],
    );
  }
}
