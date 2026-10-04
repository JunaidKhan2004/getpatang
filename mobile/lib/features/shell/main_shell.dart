import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../marketplace/application/cart_count.dart';
import '../notifications/notifications.dart';
import '../../core/i18n/i18n.dart';

/// Bottom navigation: Home, Marketplace, Tournaments, Community, Profile.
/// Cart and notifications live in each tab's app bar (see [GlobalActions]).
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  // Labels must fit five tabs on a 360dp phone; the tooltip (and screen readers) get the full name.
  static const _items = [
    (Icons.home_outlined, Icons.home, 'Home', 'Home'),
    (Icons.storefront_outlined, Icons.storefront, 'Market', 'Marketplace'),
    (Icons.emoji_events_outlined, Icons.emoji_events, 'Tourneys', 'Tournaments'),
    (Icons.groups_outlined, Icons.groups, 'Community', 'Community'),
    (Icons.person_outline, Icons.person, 'Profile', 'Profile'),
  ];

  @override
  Widget build(BuildContext context) => Scaffold(
    body: shell,
    bottomNavigationBar: NavigationBar(
      selectedIndex: shell.currentIndex,
      onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
      destinations: [
        for (final (icon, selected, label, tooltip) in _items)
          NavigationDestination(icon: Icon(icon), selectedIcon: Icon(selected), label: label.tr, tooltip: tooltip.tr),
      ],
    ),
  );
}

/// Cart and notification buttons, kept on every top-level screen.
class GlobalActions extends ConsumerWidget {
  const GlobalActions({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartCountProvider).value ?? 0;
    final unread = ref.watch(unreadCountProvider).value ?? 0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: unread > 0 ? 'Notifications, {unread} unread'.trf({'unread': unread}) : 'Notifications'.tr,
          icon: Badge(
            isLabelVisible: unread > 0,
            label: Text(unread > 99 ? '99+' : '$unread'),
            child: const Icon(Icons.notifications_none),
          ),
          onPressed: () async {
            await context.push('/notifications');
            ref.invalidate(unreadCountProvider);
          },
        ),
        IconButton(
          tooltip: count > 0 ? 'Cart, {count} items'.trf({'count': count}) : 'Cart'.tr,
          icon: Badge(
            isLabelVisible: count > 0,
            label: Text(count > 99 ? '99+' : '$count'),
            child: const Icon(Icons.shopping_bag_outlined),
          ),
          onPressed: () => context.push('/cart'),
        ),
        const SizedBox(width: 4),
      ],
    );
  }
}
