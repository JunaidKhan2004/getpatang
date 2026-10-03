import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/feedback.dart';
import '../../marketplace/data/models.dart' show formatPKR;
import '../../marketplace/widgets/market_widgets.dart';
import '../../shell/main_shell.dart';
import '../data/tournament_models.dart';
import '../data/tournaments_repository.dart';

String formatWhen(DateTime d) {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '${d.day} ${m[d.month - 1]} ${d.year}, $h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.text, this.color, {super.key});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
    child: Text(text, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color, letterSpacing: 0)),
  );
}

Widget tournamentStatusPill(TournamentCardData t) {
  if (t.status == 'IN_PROGRESS') return const StatusPill('● Live', AppColors.danger);
  if (t.registrationOpen) return const StatusPill('Registration open', AppColors.success);
  return switch (t.status) {
    'COMPLETED' => const StatusPill('Completed', AppColors.muted),
    'CANCELLED' => const StatusPill('Cancelled', AppColors.danger),
    _ => const StatusPill('Upcoming', AppColors.info),
  };
}

class TournamentTile extends StatelessWidget {
  const TournamentTile({super.key, required this.t});
  final TournamentCardData t;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        onTap: () => context.push('/tournament/${t.slug}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              tournamentStatusPill(t),
              const SizedBox(height: 8),
              Text(t.name, style: theme.textTheme.titleMedium),
              const SizedBox(height: 6),
              _line(context, Icons.event_outlined, formatWhen(t.startsAt)),
              _line(context, Icons.place_outlined, '${t.venue}, ${t.city}'),
              _line(
                context,
                Icons.groups_outlined,
                '${t.registeredCount}/${t.maxParticipants} players · ${t.entryFee == 0 ? 'Free entry' : formatPKR(t.entryFee)}',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _line(BuildContext context, IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(top: 2),
    child: Row(
      children: [
        Icon(icon, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
        const SizedBox(width: 6),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.bodySmall)),
      ],
    ),
  );
}

const _views = {null: 'All', 'open': 'Open', 'upcoming': 'Upcoming', 'live': 'Live', 'completed': 'Results'};

class TournamentsTab extends ConsumerStatefulWidget {
  const TournamentsTab({super.key});

  @override
  ConsumerState<TournamentsTab> createState() => _TournamentsTabState();
}

class _TournamentsTabState extends ConsumerState<TournamentsTab> {
  String? _view;

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(tournamentsRepositoryProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tournaments'),
        actions: [
          IconButton(
            tooltip: 'Rankings',
            icon: const Icon(Icons.leaderboard_outlined),
            onPressed: () => context.push('/rankings'),
          ),
          const GlobalActions(),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              children: [
                for (final e in _views.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(e.value),
                      selected: _view == e.key,
                      onSelected: (_) => setState(() => _view = e.key),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: PagedView<TournamentCardData>(
              key: ValueKey(_view),
              fetch: (page) => repo.list(view: _view, page: page),
              itemBuilder: (_, t) => TournamentTile(t: t),
              header: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                child: Text(
                  'Every event here has a local permit and published safety rules.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              empty: const EmptyState(
                icon: Icons.emoji_events_outlined,
                title: 'No tournaments here yet',
                message: 'Check back soon or try another filter.',
              ),
            ),
          ),
        ],
      ),
    );
  }
}
