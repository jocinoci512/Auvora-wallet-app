import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../portfolio/portfolio_controller.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import '../wallet_engine/sync_coordinator.dart';
import 'home/activity_tab.dart';
import 'home/assets_tab.dart';
import 'home/home_tab.dart';
import 'home/more_tab.dart';
import 'home/search_screen.dart';

/// Post-unlock shell — four destinations keep thumb reach calm.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  bool _bootstrapped = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bootstrapped) return;
    _bootstrapped = true;
    final address = context.read<WalletController>().address;
    final wallet = context.read<WalletController>();
    final portfolio = context.read<PortfolioController>();
    final sync = context.read<SyncCoordinator>();
    final syncEngine = sync.syncEngine;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final cold = wallet.coldStartMs;
      if (cold != null) {
        syncEngine.recordColdStart(Duration(milliseconds: cold));
      }
      await portfolio.bootstrap(address);
      sync.start(address: address);
    });
  }

  @override
  void dispose() {
    // Coordinator lives in the provider tree for the app lifetime.
    super.dispose();
  }

  void openTab(int index) => setState(() => _index = index);

  void openSearch() {
    final portfolio = context.read<PortfolioController>();
    portfolio.setGlobalQuery('');
    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            fullscreenDialog: true,
            builder: (_) => const SearchScreen(),
          ),
        )
        .then((_) {
      if (mounted) portfolio.setGlobalQuery('');
    });
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;

    return Scaffold(
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: wide ? 1120 : double.infinity),
            child: wide
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      NavigationRail(
                        selectedIndex: _index,
                        onDestinationSelected: openTab,
                        labelType: NavigationRailLabelType.all,
                        backgroundColor: Colors.transparent,
                        leading: Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: IconButton(
                            tooltip: 'Search',
                            onPressed: openSearch,
                            icon: const Icon(Icons.search_rounded),
                          ),
                        ),
                        destinations: const [
                          NavigationRailDestination(
                            icon: Icon(Icons.home_outlined),
                            selectedIcon: Icon(Icons.home_rounded),
                            label: Text('Home'),
                          ),
                          NavigationRailDestination(
                            icon: Icon(Icons.pie_chart_outline_rounded),
                            selectedIcon: Icon(Icons.pie_chart_rounded),
                            label: Text('Assets'),
                          ),
                          NavigationRailDestination(
                            icon: Icon(Icons.receipt_long_outlined),
                            selectedIcon: Icon(Icons.receipt_long_rounded),
                            label: Text('Activity'),
                          ),
                          NavigationRailDestination(
                            icon: Icon(Icons.person_outline_rounded),
                            selectedIcon: Icon(Icons.person_rounded),
                            label: Text('More'),
                          ),
                        ],
                      ),
                      const VerticalDivider(width: 1),
                      Expanded(child: _pageAt(_index, desktop: true)),
                    ],
                  )
                : IndexedStack(
                    index: _index,
                    children: [
                      _pageAt(0, desktop: false),
                      const AssetsTab(),
                      const ActivityTab(),
                      const MoreTab(),
                    ],
                  ),
          ),
        ),
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: openTab,
              height: 64,
              backgroundColor: Theme.of(context).colorScheme.surface,
              indicatorColor: AetherColors.lagoon.withValues(alpha: 0.12),
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home_rounded, color: AetherColors.lagoon),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.pie_chart_outline_rounded),
                  selectedIcon: Icon(Icons.pie_chart_rounded, color: AetherColors.lagoon),
                  label: 'Assets',
                ),
                NavigationDestination(
                  icon: Icon(Icons.receipt_long_outlined),
                  selectedIcon: Icon(Icons.receipt_long_rounded, color: AetherColors.lagoon),
                  label: 'Activity',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline_rounded),
                  selectedIcon: Icon(Icons.person_rounded, color: AetherColors.lagoon),
                  label: 'More',
                ),
              ],
            ),
    );
  }

  Widget _pageAt(int index, {required bool desktop}) {
    switch (index) {
      case 0:
        return HomeTab(
          desktop: desktop,
          onOpenAssets: () => openTab(1),
          onOpenActivity: () => openTab(2),
          onOpenSearch: openSearch,
          onOpenMore: () => openTab(3),
        );
      case 1:
        return const AssetsTab();
      case 2:
        return const ActivityTab();
      default:
        return const MoreTab();
    }
  }
}
