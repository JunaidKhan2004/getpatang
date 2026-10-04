import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/widgets/feedback.dart';
import '../auth/application/auth_controller.dart';
import '../shell/main_shell.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/language.dart';

class ProfileTab extends ConsumerWidget {
  const ProfileTab({super.key});

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Sign out?'.tr),
        content: Text('You will need to sign in again to see your orders and tournaments.'.tr),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text('Cancel'.tr)),
          TextButton(onPressed: () => Navigator.pop(c, true), child: Text('Sign out'.tr)),
        ],
      ),
    );
    if (ok == true) await ref.read(authControllerProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final t = Theme.of(context);

    if (auth is! Authenticated) {
      return Scaffold(
        appBar: AppBar(title: Text('Profile'.tr), actions: const [GlobalActions()]),
        body: Column(
          children: [
            Expanded(
              child: EmptyState(
                icon: Icons.person_outline,
                title: 'Sign in to your account'.tr,
                message: 'Track orders, register for tournaments and follow shops.'.tr,
                action: SizedBox(
                  width: 220,
                  child: FilledButton(onPressed: () => context.push('/login'), child: Text('Sign in'.tr)),
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsetsDirectional.fromSTEB(16, 0, 16, 16),
              child: Card(child: LanguageTile()),
            ),
          ],
        ),
      );
    }

    final user = auth.user;
    final name = user.profile?.displayName ?? user.fullName;
    return Scaffold(
      appBar: AppBar(title: Text('Profile'.tr), actions: const [GlobalActions()]),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: t.colorScheme.primary,
                    foregroundColor: t.colorScheme.onPrimary,
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : '?',
                      style: t.textTheme.titleLarge?.copyWith(color: t.colorScheme.onPrimary),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: t.textTheme.titleMedium),
                        Text(
                          [user.profile?.city, user.email].whereType<String>().join(' · '),
                          style: t.textTheme.bodySmall,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.receipt_long_outlined),
                  title: Text('My orders'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/orders'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.favorite_border),
                  title: Text('Wishlist'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/wishlist'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.emoji_events_outlined),
                  title: Text('My tournaments'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/my-tournaments'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.military_tech_outlined),
                  title: Text('My player profile'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/player/${user.id}'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.celebration_outlined),
                  title: Text('My events'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/my-events'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.palette_outlined),
                  title: Text('My kite designs'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/designs'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.design_services_outlined),
                  title: Text('Custom orders'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/custom-orders'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.notifications_outlined),
                  title: Text('Notification settings'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/notification-settings'),
                ),
                const Divider(),
                const LanguageTile(),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: Text('About GetPatang'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/legal/about'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.help_outline),
                  title: Text('FAQ'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/legal/faq'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.support_agent_outlined),
                  title: Text('Contact'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/legal/contact'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.description_outlined),
                  title: Text('Terms of Service'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/legal/terms'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.privacy_tip_outlined),
                  title: Text('Privacy Policy'.tr),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/legal/privacy'),
                ),
                const Divider(),
                ListTile(
                  leading: Icon(Icons.logout, color: t.colorScheme.error),
                  title: Text('Sign out'.tr, style: TextStyle(color: t.colorScheme.error)),
                  onTap: () => _confirmLogout(context, ref),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
