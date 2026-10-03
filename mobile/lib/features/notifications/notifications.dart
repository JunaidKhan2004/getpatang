import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/widgets/feedback.dart';
import '../auth/application/auth_controller.dart';
import '../marketplace/data/models.dart' show PageResult;
import '../marketplace/widgets/market_widgets.dart';

class NotificationData {
  const NotificationData(this.id, this.category, this.title, this.body, this.link, this.read, this.createdAt);
  final String id;
  final String category;
  final String title;
  final String body;
  final String? link;
  final bool read;
  final DateTime createdAt;

  factory NotificationData.fromJson(Map<String, dynamic> j) => NotificationData(
    j['id'] as String,
    j['category'] as String,
    j['title'] as String,
    j['body'] as String,
    j['link'] as String?,
    j['readAt'] != null,
    DateTime.parse(j['createdAt'] as String).toLocal(),
  );
}

class CategoryPref {
  CategoryPref(this.key, this.label, this.description, this.inApp, this.email, this.push);
  final String key;
  final String label;
  final String description;
  bool inApp;
  bool email;
  bool push;
}

class NotificationsRepository {
  NotificationsRepository(this._api);
  final ApiClient _api;

  Future<PageResult<NotificationData>> list({bool unread = false, int page = 1}) async {
    try {
      final res = await _api.dio.get<Map<String, dynamic>>(
        '/notifications',
        queryParameters: {'page': page, 'pageSize': 20, if (unread) 'unread': true},
      );
      final meta = res.data!['meta'] as Map<String, dynamic>;
      return PageResult(
        [for (final j in (res.data!['data'] as List)) NotificationData.fromJson(j as Map<String, dynamic>)],
        meta['page'] as int,
        meta['totalPages'] as int,
        meta['total'] as int,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<int> unreadCount() async =>
      (await _api.request<Map<String, dynamic>>('GET', '/notifications/unread-count'))['count'] as int;

  Future<void> markRead(String id) => _api.request<Map<String, dynamic>>('POST', '/notifications/$id/read');
  Future<void> markAllRead() => _api.request<Map<String, dynamic>>('POST', '/notifications/read-all');

  Future<({bool push, List<CategoryPref> categories})> preferences() async {
    final res = await _api.request<Map<String, dynamic>>('GET', '/notifications/preferences');
    return (
      push: (res['channels'] as Map)['push'] as bool,
      categories: [
        for (final c in res['categories'] as List)
          CategoryPref(
            (c as Map)['key'] as String,
            c['label'] as String,
            c['description'] as String,
            c['inApp'] as bool,
            c['email'] as bool,
            c['push'] as bool,
          ),
      ],
    );
  }

  Future<void> savePreferences(List<CategoryPref> prefs) => _api.request<Map<String, dynamic>>(
    'PUT',
    '/notifications/preferences',
    body: {
      'prefs': {
        for (final c in prefs) c.key: {'inApp': c.inApp, 'email': c.email, 'push': c.push},
      },
    },
  );
}

final notificationsRepositoryProvider = Provider((ref) => NotificationsRepository(ref.watch(apiClientProvider)));

/// Unread count for the bell. Zero when signed out; refreshed when the inbox changes.
final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  if (ref.watch(authControllerProvider) is! Authenticated) return 0;
  try {
    return await ref.watch(notificationsRepositoryProvider).unreadCount();
  } on ApiException {
    return 0;
  }
});

/// Web links stored on notifications, mapped to app routes. Unknown links open nothing.
String? appRouteFor(String? link) {
  if (link == null) return null;
  final uri = Uri.parse(link);
  final p = uri.pathSegments;
  if (p.isEmpty) return null;
  return switch (p) {
    ['account', 'orders', final n] => '/orders/$n',
    ['account', 'custom-orders', final id] => '/custom-orders/$id',
    ['tournaments', final slug] => '/tournament/$slug',
    ['events', final slug] => '/event/$slug',
    ['community', 'posts', final id] => '/post/$id',
    ['community', 'u', final id] => '/u/$id',
    _ => null,
  };
}

const _icons = {
  'orders': Icons.inventory_2_outlined,
  'payments': Icons.payments_outlined,
  'shop': Icons.storefront_outlined,
  'custom_orders': Icons.palette_outlined,
  'tournaments': Icons.emoji_events_outlined,
  'events': Icons.celebration_outlined,
  'community': Icons.forum_outlined,
};

String _ago(DateTime d) {
  final s = DateTime.now().difference(d).inSeconds;
  if (s < 60) return 'Just now';
  if (s < 3600) return '${s ~/ 60} min ago';
  if (s < 86400) return '${s ~/ 3600} h ago';
  if (s < 172800) return 'Yesterday';
  return '${d.day}/${d.month}/${d.year}';
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _unread = false;
  int _version = 0;
  final _readIds = <String>{};

  Future<void> _open(NotificationData n) async {
    final repo = ref.read(notificationsRepositoryProvider);
    if (!n.read && !_readIds.contains(n.id)) {
      setState(() => _readIds.add(n.id));
      repo.markRead(n.id).then((_) => ref.invalidate(unreadCountProvider)).ignore();
    }
    final route = appRouteFor(n.link);
    if (route != null) context.push(route);
  }

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(notificationsRepositoryProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            tooltip: 'Mark all as read',
            icon: const Icon(Icons.done_all),
            onPressed: () async {
              try {
                await repo.markAllRead();
                ref.invalidate(unreadCountProvider);
                setState(() => _version++);
              } on ApiException catch (e) {
                if (context.mounted) showToast(context, e.message, kind: ToastKind.error);
              }
            },
          ),
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.tune),
            onPressed: () => context.push('/notification-settings'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('All'),
                  selected: !_unread,
                  onSelected: (_) => setState(() => _unread = false),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Unread'),
                  selected: _unread,
                  onSelected: (_) => setState(() => _unread = true),
                ),
              ],
            ),
          ),
          Expanded(
            child: PagedView<NotificationData>(
              key: ValueKey('$_unread-$_version'),
              padding: const EdgeInsets.symmetric(vertical: 8),
              fetch: (page) => repo.list(unread: _unread, page: page),
              itemBuilder: (context, n) {
                final read = n.read || _readIds.contains(n.id);
                final t = Theme.of(context);
                return ListTile(
                  tileColor: read ? null : t.colorScheme.primaryContainer.withValues(alpha: 0.35),
                  leading: CircleAvatar(
                    backgroundColor: t.colorScheme.primaryContainer,
                    child: Icon(_icons[n.category] ?? Icons.notifications_none, color: t.colorScheme.primary, size: 20),
                  ),
                  title: Text(n.title, style: TextStyle(fontWeight: read ? FontWeight.w500 : FontWeight.w700)),
                  subtitle: Text('${n.body}\n${_ago(n.createdAt)}'),
                  isThreeLine: true,
                  onTap: () => _open(n),
                );
              },
              empty: EmptyState(
                icon: Icons.notifications_none,
                title: _unread ? "You're all caught up" : 'No notifications yet',
                message: 'Order, payment, tournament and community updates will appear here.',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final _prefsProvider = FutureProvider.autoDispose((ref) => ref.watch(notificationsRepositoryProvider).preferences());

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen> {
  bool _saving = false;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Notification settings')),
    body: AsyncBody(
      value: ref.watch(_prefsProvider),
      onRetry: () => ref.invalidate(_prefsProvider),
      builder: (p) => StatefulBuilder(
        builder: (context, setLocal) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Choose how we tell you about each kind of update. Security messages, like sign-in codes, are always sent.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            for (final c in p.categories)
              Card(
                margin: const EdgeInsets.only(top: 12),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.label, style: Theme.of(context).textTheme.titleMedium),
                      Text(c.description, style: Theme.of(context).textTheme.bodySmall),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('In the app'),
                        value: c.inApp,
                        onChanged: (v) => setLocal(() => c.inApp = v),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Email'),
                        value: c.email,
                        onChanged: (v) => setLocal(() => c.email = v),
                      ),
                      if (p.push)
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Push'),
                          value: c.push,
                          onChanged: (v) => setLocal(() => c.push = v),
                        ),
                    ],
                  ),
                ),
              ),
            if (!p.push)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  'Phone push notifications will be added once they are set up for the app.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            const SizedBox(height: 16),
            LoadingButton(
              label: 'Save settings',
              loading: _saving,
              onPressed: () async {
                setState(() => _saving = true);
                try {
                  await ref.read(notificationsRepositoryProvider).savePreferences(p.categories);
                  if (context.mounted) showToast(context, 'Notification settings saved.', kind: ToastKind.success);
                } on ApiException catch (e) {
                  if (context.mounted) showToast(context, e.message, kind: ToastKind.error);
                } finally {
                  if (mounted) setState(() => _saving = false);
                }
              },
            ),
          ],
        ),
      ),
    ),
  );
}
