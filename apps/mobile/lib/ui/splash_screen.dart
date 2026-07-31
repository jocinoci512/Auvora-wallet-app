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
  late final Animation<double> _bloom;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
    _fade = CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.55, curve: Curves.easeOut));
    _lift = Tween(begin: 14.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.05, 0.7, curve: Curves.easeOutCubic)),
    );
    _bloom = Tween(begin: 0.72, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.85, curve: Curves.easeOutCubic)),
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
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF07262E),
              AetherColors.lagoonDeep,
              AetherColors.lagoon,
              Color(0xFF0A2E36),
            ],
            stops: [0.0, 0.35, 0.72, 1.0],
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              top: -80,
              right: -60,
              child: AnimatedBuilder(
                animation: _bloom,
                builder: (context, _) => Transform.scale(
                  scale: reduce ? 1 : _bloom.value,
                  child: Container(
                    width: 260,
                    height: 260,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          AetherColors.lagoonSoft.withValues(alpha: 0.28),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -40,
              left: -40,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF1A6B78).withValues(alpha: 0.22),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Center(
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
          ],
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: 0.28), width: 1.2),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withValues(alpha: 0.18),
                Colors.white.withValues(alpha: 0.04),
              ],
            ),
          ),
          child: Center(
            child: Text(
              'A',
              style: theme.textTheme.headlineMedium?.copyWith(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w700,
                letterSpacing: -1,
              ),
            ),
          ),
        ),
        const SizedBox(height: 22),
        Text(
          'Auvora',
          style: theme.textTheme.displaySmall?.copyWith(
            color: Colors.white,
            fontSize: 46,
            fontWeight: FontWeight.w700,
            letterSpacing: -1.6,
            height: 1,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Quiet custody for digital value',
          style: theme.textTheme.bodyLarge?.copyWith(
            color: AetherColors.lagoonMist,
            fontSize: 15,
            height: 1.35,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
