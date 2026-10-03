import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/feedback.dart';
import '../../marketplace/widgets/market_widgets.dart';
import '../data/tournament_models.dart';
import '../data/tournaments_repository.dart';
import 'tournaments_tab.dart';

class RankingsScreen extends ConsumerStatefulWidget {
  const RankingsScreen({super.key});

  @override
  ConsumerState<RankingsScreen> createState() => _RankingsScreenState();
}

class _RankingsScreenState extends ConsumerState<RankingsScreen> {
  String? _season;
  String? _city;
  late final _filters = ref.read(tournamentsRepositoryProvider).rankingFilters();

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(tournamentsRepositoryProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Rankings')),
      body: Column(
        children: [
          FutureBuilder(
            future: _filters,
            builder: (c, snap) {
              final f = snap.data;
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String?>(
                        initialValue: _season,
                        isDense: true,
                        decoration: const InputDecoration(labelText: 'Season'),
                        items: [
                          const DropdownMenuItem(value: null, child: Text('All')),
                          for (final s in f?.seasons ?? const <String>[]) DropdownMenuItem(value: s, child: Text(s)),
                        ],
                        onChanged: (v) => setState(() => _season = v),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String?>(
                        initialValue: _city,
                        isDense: true,
                        decoration: const InputDecoration(labelText: 'City'),
                        items: [
                          const DropdownMenuItem(value: null, child: Text('Pakistan')),
                          for (final s in f?.cities ?? const <String>[]) DropdownMenuItem(value: s, child: Text(s)),
                        ],
                        onChanged: (v) => setState(() => _city = v),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          Expanded(
            child: PagedView<RankingRowData>(
              key: ValueKey('$_season|$_city'),
              fetch: (page) => repo.rankings(season: _season, city: _city, page: page),
              empty: const EmptyState(
                icon: Icons.leaderboard_outlined,
                title: 'No ranked players yet',
                message: 'Rankings appear after the first tournament is completed.',
              ),
              itemBuilder: (_, r) => Card(
                child: ListTile(
                  onTap: () => context.push('/player/${r.userId}'),
                  leading: CircleAvatar(
                    backgroundColor: r.rank <= 3 ? AppColors.maroon500 : theme.colorScheme.surfaceContainerHighest,
                    foregroundColor: r.rank <= 3 ? AppColors.white : theme.colorScheme.onSurface,
                    child: Text('${r.rank}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  title: Text(r.name),
                  subtitle: Text(
                    [
                      r.city,
                      '${r.matches} matches',
                      if (r.winRate != null) '${r.winRate}% won',
                      if (r.championships > 0) '${r.championships} titles',
                    ].whereType<String>().join(' · '),
                  ),
                  trailing: Text('${r.points}', style: theme.textTheme.titleMedium),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PlayerScreen extends ConsumerWidget {
  const PlayerScreen({super.key, required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Player')),
      body: AsyncBody(
        value: ref.watch(playerProvider(userId)),
        onRetry: () => ref.invalidate(playerProvider(userId)),
        builder: (p) {
          final s = p.stats;
          Widget stat(String label, Object? value) => Expanded(
            child: Column(
              children: [
                Text('${value ?? '—'}', style: theme.textTheme.titleLarge),
                Text(label, style: theme.textTheme.bodySmall),
              ],
            ),
          );
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  CircleAvatar(radius: 32, child: Text(p.name[0].toUpperCase(), style: theme.textTheme.headlineSmall)),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.name, style: theme.textTheme.headlineSmall),
                        if (p.city != null) Text(p.city!, style: theme.textTheme.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
              if (p.bio != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(p.bio!)),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          stat('Rank', s['rank'] == null ? null : '#${s['rank']}'),
                          stat('Points', s['points']),
                          stat('Titles', s['championships']),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          stat('Matches', s['matches']),
                          stat('Wins', s['wins']),
                          stat('Win rate', s['winRate'] == null ? null : '${s['winRate']}%'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Badges', style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              if (p.badges.isEmpty)
                Text('Badges are earned by playing in and winning tournaments.', style: theme.textTheme.bodySmall)
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final b in p.badges)
                      Tooltip(
                        message: b.description,
                        child: Chip(avatar: const Icon(Icons.military_tech, size: 18), label: Text(b.label)),
                      ),
                  ],
                ),
              const SizedBox(height: 16),
              Text('Tournament results', style: theme.textTheme.titleLarge),
              if (p.results.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('No results yet.', style: theme.textTheme.bodySmall),
                ),
              for (final r in p.results)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(r.name),
                  subtitle: Text('${placementLabel(r.placement)} · ${r.wins}–${r.losses}'),
                  trailing: Text('${r.points} pts'),
                  onTap: () => context.push('/tournament/${r.slug}'),
                ),
            ],
          );
        },
      ),
    );
  }
}

class MyTournamentsScreen extends ConsumerWidget {
  const MyTournamentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('My tournaments')),
    body: AsyncBody(
      value: ref.watch(myTournamentsProvider),
      onRetry: () => ref.invalidate(myTournamentsProvider),
      builder: (list) {
        if (list.isEmpty) {
          return EmptyState(
            icon: Icons.emoji_events_outlined,
            title: 'No tournaments yet',
            message: 'Register for an approved tournament near you.',
            action: FilledButton(onPressed: () => context.go('/tournaments'), child: const Text('Find tournaments')),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final e = list[i];
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TournamentTile(t: e.tournament),
                Padding(
                  padding: const EdgeInsets.only(left: 4, top: 4),
                  child: Text(
                    [
                      participantStatusLabels[e.status] ?? e.status,
                      if (e.placement != null) placementLabel(e.placement),
                      e.note,
                    ].whereType<String>().join(' · '),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            );
          },
        );
      },
    ),
  );
}
