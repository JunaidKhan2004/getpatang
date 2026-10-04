import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/kite_mark.dart';
import '../marketplace/data/models.dart' show PageResult, formatPKR;
import '../marketplace/presentation/product_screen.dart' show ensureSignedIn;
import '../marketplace/widgets/market_widgets.dart';
import '../tournaments/presentation/tournaments_tab.dart' show StatusPill, formatWhen;
import '../../core/i18n/i18n.dart';

// ─── Models (mirror backend/src/modules/events/events.ts) ────────────────────

const eventTypeLabels = {
  'festival': 'Festival',
  'exhibition': 'Exhibition',
  'workshop': 'Workshop',
  'gathering': 'Gathering',
  'competition': 'Competition',
};

class EventData {
  const EventData({
    required this.id,
    required this.slug,
    required this.name,
    required this.type,
    required this.city,
    required this.venue,
    required this.startsAt,
    required this.endsAt,
    required this.organizerName,
    required this.fee,
    required this.capacity,
    required this.registrationRequired,
    required this.registrationClosesAt,
    required this.status,
    required this.attending,
    required this.registrationOpen,
    this.description,
    this.venueAddress,
    this.organizerContact,
    this.rules,
    this.safetyNotes,
    this.maxGuests = 0,
    this.cancelReason,
    this.waitlisted = 0,
    this.myStatus,
    this.myGuests = 0,
    this.tournamentSlug,
    this.tournamentName,
  });

  final String id;
  final String slug;
  final String name;
  final String type;
  final String city;
  final String venue;
  final DateTime startsAt;
  final DateTime? endsAt;
  final String organizerName;
  final int fee;
  final int? capacity;
  final bool registrationRequired;
  final DateTime? registrationClosesAt;
  final String status;
  final int attending;
  final bool registrationOpen;
  final String? description;
  final String? venueAddress;
  final String? organizerContact;
  final String? rules;
  final String? safetyNotes;
  final int maxGuests;
  final String? cancelReason;
  final int waitlisted;
  final String? myStatus;
  final int myGuests;
  final String? tournamentSlug;
  final String? tournamentName;

  static DateTime? _d(Object? v) => v == null ? null : DateTime.parse(v as String).toLocal();

  factory EventData.fromJson(Map<String, dynamic> j) {
    final mine = j['myRegistration'] as Map?;
    final t = j['tournament'] as Map?;
    return EventData(
      id: j['id'] as String,
      slug: j['slug'] as String,
      name: j['name'] as String,
      type: j['type'] as String,
      city: j['city'] as String,
      venue: j['venue'] as String,
      startsAt: _d(j['startsAt'])!,
      endsAt: _d(j['endsAt']),
      organizerName: j['organizerName'] as String,
      fee: j['fee'] as int,
      capacity: j['capacity'] as int?,
      registrationRequired: j['registrationRequired'] as bool,
      registrationClosesAt: _d(j['registrationClosesAt']),
      status: j['status'] as String,
      attending: j['attending'] as int? ?? 0,
      registrationOpen: j['registrationOpen'] as bool? ?? false,
      description: j['description'] as String?,
      venueAddress: j['venueAddress'] as String?,
      organizerContact: j['organizerContact'] as String?,
      rules: j['rules'] as String?,
      safetyNotes: j['safetyNotes'] as String?,
      maxGuests: j['maxGuests'] as int? ?? 0,
      cancelReason: j['cancelReason'] as String?,
      waitlisted: j['waitlisted'] as int? ?? 0,
      myStatus: mine?['status'] as String?,
      myGuests: mine?['guests'] as int? ?? 0,
      tournamentSlug: t?['slug'] as String?,
      tournamentName: t?['name'] as String?,
    );
  }
}

// ─── Repository ─────────────────────────────────────────────────────────────

class EventsRepository {
  EventsRepository(this._api);
  final ApiClient _api;

  Future<PageResult<EventData>> list({bool past = false, String? type, int page = 1}) async {
    try {
      final res = await _api.dio.get<Map<String, dynamic>>(
        '/events',
        queryParameters: {'when': past ? 'past' : null, 'type': ?type, 'page': page, 'pageSize': 20}
          ..removeWhere((_, v) => v == null),
      );
      final meta = res.data!['meta'] as Map<String, dynamic>;
      return PageResult(
        [for (final j in (res.data!['data'] as List)) EventData.fromJson(j as Map<String, dynamic>)],
        meta['page'] as int,
        meta['totalPages'] as int,
        meta['total'] as int,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<EventData> detail(String slug) async =>
      EventData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/events/$slug'));

  Future<String> register(String slug, int guests) async =>
      (await _api.request<Map<String, dynamic>>(
            'POST',
            '/events/$slug/registration',
            body: {'guests': guests},
          ))['message']
          as String;

  Future<void> cancel(String slug) => _api.request<Map<String, dynamic>>('DELETE', '/events/$slug/registration');

  Future<List<({String status, int guests, EventData event})>> mine() async => [
    for (final r in await _api.request<List<dynamic>>('GET', '/events/mine'))
      (
        status: (r as Map)['status'] as String,
        guests: r['guests'] as int,
        event: EventData.fromJson(r['event'] as Map<String, dynamic>),
      ),
  ];
}

final eventsRepositoryProvider = Provider((ref) => EventsRepository(ref.watch(apiClientProvider)));
final eventProvider = FutureProvider.autoDispose.family<EventData, String>(
  (ref, slug) => ref.watch(eventsRepositoryProvider).detail(slug),
);
final myEventsProvider = FutureProvider.autoDispose((ref) => ref.watch(eventsRepositoryProvider).mine());

// ─── Widgets ────────────────────────────────────────────────────────────────

Widget eventStatusPill(EventData e) {
  if (e.status == 'CANCELLED') return StatusPill('Cancelled'.tr, AppColors.danger);
  if (e.status == 'COMPLETED') return StatusPill('Completed'.tr, AppColors.muted);
  if (e.registrationOpen) return StatusPill('Registration open'.tr, AppColors.success);
  return StatusPill(e.registrationRequired ? 'Registration closed'.tr : 'Open to all'.tr, AppColors.info);
}

String _going(EventData e) => e.capacity == null
    ? '{attending} going'.trf({'attending': e.attending})
    : '{attending}/{capacity} going'.trf({'attending': e.attending, 'capacity': e.capacity});

class EventTile extends StatelessWidget {
  const EventTile({super.key, required this.e, this.footer});
  final EventData e;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Widget line(IconData icon, String text) => Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        children: [
          Icon(icon, size: 16, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 6),
          Expanded(child: Text(text, style: theme.textTheme.bodySmall)),
        ],
      ),
    );
    return Card(
      child: InkWell(
        onTap: () => context.push('/event/${e.slug}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [StatusPill(eventTypeLabels[e.type]?.tr ?? e.type, AppColors.maroon900), eventStatusPill(e)],
              ),
              const SizedBox(height: 8),
              Text(e.name, style: theme.textTheme.titleMedium),
              const SizedBox(height: 6),
              line(Icons.event_outlined, formatWhen(e.startsAt)),
              line(Icons.place_outlined, '${e.venue}, ${e.city}'),
              line(Icons.groups_outlined, '${_going(e)} · ${e.fee == 0 ? 'Free' : formatPKR(e.fee)}'),
              ?footer,
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Screens ────────────────────────────────────────────────────────────────

class EventsScreen extends ConsumerStatefulWidget {
  const EventsScreen({super.key});

  @override
  ConsumerState<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends ConsumerState<EventsScreen> {
  bool _past = false;
  String? _type;

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(eventsRepositoryProvider);
    return Scaffold(
      appBar: AppBar(title: Text('Events'.tr)),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              children: [
                ChoiceChip(
                  label: Text('Upcoming'.tr),
                  selected: !_past,
                  onSelected: (_) => setState(() => _past = false),
                ),
                const SizedBox(width: 8),
                ChoiceChip(label: Text('Past'.tr), selected: _past, onSelected: (_) => setState(() => _past = true)),
                const SizedBox(width: 16),
                for (final t in eventTypeLabels.entries)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 8),
                    child: FilterChip(
                      label: Text(t.value.tr),
                      selected: _type == t.key,
                      onSelected: (s) => setState(() => _type = s ? t.key : null),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: PagedView<EventData>(
              key: ValueKey('$_past-$_type'),
              fetch: (page) => repo.list(past: _past, type: _type, page: page),
              itemBuilder: (_, e) => EventTile(e: e),
              empty: EmptyState(
                icon: Icons.celebration_outlined,
                title: 'No events here yet'.tr,
                message: 'Festivals, exhibitions and workshops will appear here.'.tr,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class EventScreen extends ConsumerWidget {
  const EventScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: Text('Event'.tr)),
    body: AsyncBody(
      value: ref.watch(eventProvider(slug)),
      onRetry: () => ref.invalidate(eventProvider(slug)),
      builder: (e) => RefreshIndicator(
        onRefresh: () => ref.refresh(eventProvider(slug).future),
        child: _EventBody(e: e),
      ),
    ),
  );
}

class _EventBody extends StatelessWidget {
  const _EventBody({required this.e});
  final EventData e;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Widget fact(IconData icon, String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: theme.colorScheme.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: theme.textTheme.bodySmall),
                Text(value, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Container(
          color: AppColors.maroon900,
          padding: const EdgeInsets.all(20),
          child: Stack(
            children: [
              const Positioned.fill(child: KitePattern(cell: 40)),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  eventStatusPill(e),
                  const SizedBox(height: 10),
                  Text(e.name, style: theme.textTheme.headlineSmall?.copyWith(color: AppColors.white)),
                  const SizedBox(height: 6),
                  Text(
                    '{type} · by {organizerName}'.trf({
                      'type': eventTypeLabels[e.type]?.tr ?? e.type,
                      'organizerName': e.organizerName,
                    }),
                    style: theme.textTheme.bodySmall?.copyWith(color: AppColors.maroon100),
                  ),
                ],
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (e.cancelReason != null) ...[
                Card(
                  color: AppColors.danger.withValues(alpha: 0.08),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text('Cancelled: {cancelReason}'.trf({'cancelReason': e.cancelReason})),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              _EventRegistration(e: e),
              const SizedBox(height: 12),
              fact(
                Icons.event_outlined,
                'When'.tr,
                formatWhen(e.startsAt) + (e.endsAt != null ? ' – ${formatWhen(e.endsAt!)}' : ''),
              ),
              fact(Icons.place_outlined, 'Where'.tr, [e.venue, e.venueAddress, e.city].whereType<String>().join(', ')),
              fact(
                Icons.groups_outlined,
                'Going'.tr,
                _going(e) + (e.waitlisted > 0 ? ' · {waitlisted} waiting'.trf({'waitlisted': e.waitlisted}) : ''),
              ),
              fact(
                Icons.payments_outlined,
                'Fee'.tr,
                e.fee == 0 ? 'Free'.tr : '{fee}, paid to the organizer'.trf({'fee': formatPKR(e.fee)}),
              ),
              if (e.organizerContact != null) fact(Icons.call_outlined, 'Organizer contact'.tr, e.organizerContact!),
              if (e.tournamentSlug != null)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.emoji_events_outlined),
                    title: Text(e.tournamentName ?? 'Tournament'.tr),
                    subtitle: Text('Tournament at this event'.tr),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/tournament/${e.tournamentSlug}'),
                  ),
                ),
              const SizedBox(height: 12),
              Text('About'.tr, style: theme.textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(e.description ?? ''),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.health_and_safety_outlined, color: theme.colorScheme.primary),
                          const SizedBox(width: 8),
                          Text('Safety'.tr, style: theme.textTheme.titleMedium),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(e.safetyNotes ?? ''),
                    ],
                  ),
                ),
              ),
              if (e.rules != null) ...[
                const SizedBox(height: 16),
                Text('Rules'.tr, style: theme.textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(e.rules!),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _EventRegistration extends ConsumerStatefulWidget {
  const _EventRegistration({required this.e});
  final EventData e;

  @override
  ConsumerState<_EventRegistration> createState() => _EventRegistrationState();
}

class _EventRegistrationState extends ConsumerState<_EventRegistration> {
  bool _busy = false;
  int _guests = 0;

  Future<void> _run(Future<String> Function() action) async {
    setState(() => _busy = true);
    try {
      final msg = await action();
      if (!mounted) return;
      showToast(context, msg, kind: ToastKind.success);
      ref
        ..invalidate(eventProvider(widget.e.slug))
        ..invalidate(myEventsProvider);
    } on ApiException catch (err) {
      if (mounted) showToast(context, err.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.e;
    final repo = ref.read(eventsRepositoryProvider);
    final theme = Theme.of(context);
    Widget box(List<Widget> children) => Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
      ),
    );

    if (!e.registrationRequired) {
      return box([Text('Open to everyone'.tr, style: theme.textTheme.titleMedium), Text('No registration needed.'.tr)]);
    }
    if (e.myStatus != null) {
      final confirmed = e.myStatus == 'CONFIRMED';
      return box([
        Text('You are registered'.tr, style: theme.textTheme.titleMedium),
        const SizedBox(height: 6),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: StatusPill(
            confirmed ? 'Confirmed'.tr : 'On the waiting list'.tr,
            confirmed ? AppColors.success : AppColors.warning,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          e.myGuests > 0
              ? 'You plus {myGuests} guest{s}.'.trf({'myGuests': e.myGuests, 's': e.myGuests > 1 ? 's' : ''})
              : 'Just you.'.tr,
        ),
        if (e.status == 'PUBLISHED' && e.startsAt.isAfter(DateTime.now())) ...[
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: _busy
                ? null
                : () => _run(() async {
                    await repo.cancel(e.slug);
                    return 'Your registration was cancelled.'.tr;
                  }),
            child: Text('Cancel registration'.tr),
          ),
        ],
      ]);
    }
    if (!e.registrationOpen) {
      return box([Text('Registration'.tr, style: theme.textTheme.titleMedium), Text('Registration is closed.'.tr)]);
    }

    final left = e.capacity == null ? null : (e.capacity! - e.attending).clamp(0, e.capacity!);
    return box([
      Text('Register'.tr, style: theme.textTheme.titleMedium),
      const SizedBox(height: 4),
      Text(
        left == null
            ? 'No limit on places.'.tr
            : (left == 0
                  ? 'The event is full. You can join the waiting list.'.tr
                  : '{left} places left.'.trf({'left': left})),
      ),
      if (e.maxGuests > 0) ...[
        const SizedBox(height: 10),
        DropdownButtonFormField<int>(
          initialValue: _guests,
          decoration: InputDecoration(labelText: 'Guests coming with you'.tr),
          items: [
            for (var i = 0; i <= e.maxGuests; i++) DropdownMenuItem(value: i, child: Text(i == 0 ? 'None'.tr : '$i')),
          ],
          onChanged: (v) => setState(() => _guests = v ?? 0),
        ),
      ],
      const SizedBox(height: 10),
      LoadingButton(
        label: left == 0 ? 'Join the waiting list'.tr : 'Register'.tr,
        loading: _busy,
        onPressed: () {
          if (!ensureSignedIn(context, ref)) return;
          _run(() => repo.register(e.slug, _guests));
        },
      ),
    ]);
  }
}

class MyEventsScreen extends ConsumerWidget {
  const MyEventsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: Text('My events'.tr)),
    body: AsyncBody(
      value: ref.watch(myEventsProvider),
      onRetry: () => ref.invalidate(myEventsProvider),
      builder: (rows) => rows.isEmpty
          ? EmptyState(
              icon: Icons.celebration_outlined,
              title: 'No registrations yet'.tr,
              message: 'Find a festival or workshop near you.'.tr,
              action: FilledButton(onPressed: () => context.push('/events'), child: Text('Browse events'.tr)),
            )
          : RefreshIndicator(
              onRefresh: () => ref.refresh(myEventsProvider.future),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (final r in rows)
                    EventTile(
                      e: r.event,
                      footer: Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: StatusPill(
                          r.status == 'CONFIRMED'
                              ? 'Confirmed{guests}'.trf({'guests': r.guests > 0 ? ' · +${r.guests}' : ''})
                              : 'Waiting list{guests}'.trf({'guests': r.guests > 0 ? ' · +${r.guests}' : ''}),
                          r.status == 'CONFIRMED' ? AppColors.success : AppColors.warning,
                        ),
                      ),
                    ),
                ],
              ),
            ),
    ),
  );
}
