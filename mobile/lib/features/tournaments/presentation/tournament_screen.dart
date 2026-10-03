import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/kite_mark.dart';
import '../../marketplace/data/models.dart' show formatPKR;
import '../../marketplace/presentation/product_screen.dart' show ensureSignedIn;
import '../../marketplace/widgets/market_widgets.dart';
import '../data/tournament_models.dart';
import '../data/tournaments_repository.dart';
import 'tournaments_tab.dart';

class TournamentScreen extends ConsumerWidget {
  const TournamentScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) => AsyncBody(
    value: ref.watch(tournamentProvider(slug)),
    onRetry: () => ref.invalidate(tournamentProvider(slug)),
    builder: (t) => DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Text(t.card.name, overflow: TextOverflow.ellipsis),
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: 'Overview'),
              Tab(text: 'Players'),
              Tab(text: 'Bracket'),
              Tab(text: 'Rules'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _Overview(t: t),
            _Players(slug: slug),
            _Bracket(slug: slug, myEntryId: t.myEntryId),
            _Rules(t: t),
          ],
        ),
      ),
    ),
  );
}

class _Overview extends ConsumerWidget {
  const _Overview({required this.t});
  final TournamentDetailData t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final c = t.card;
    return RefreshIndicator(
      onRefresh: () => ref.refresh(tournamentProvider(c.slug).future),
      child: ListView(
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
                    tournamentStatusPill(c),
                    const SizedBox(height: 10),
                    Text(c.name, style: theme.textTheme.headlineSmall?.copyWith(color: AppColors.white)),
                    const SizedBox(height: 6),
                    Text(
                      'Organised by ${c.organizerName}',
                      style: theme.textTheme.bodySmall?.copyWith(color: AppColors.maroon100),
                    ),
                    if (t.championName != null) ...[
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          const Icon(Icons.emoji_events, color: AppColors.white, size: 20),
                          const SizedBox(width: 6),
                          Text(
                            'Champion: ${t.championName}',
                            style: theme.textTheme.titleMedium?.copyWith(color: AppColors.white),
                          ),
                        ],
                      ),
                    ],
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
                if (t.cancelReason != null) ...[
                  Card(
                    color: AppColors.danger.withValues(alpha: 0.08),
                    child: Padding(padding: const EdgeInsets.all(12), child: Text('Cancelled: ${t.cancelReason}')),
                  ),
                  const SizedBox(height: 12),
                ],
                _RegistrationCard(t: t),
                const SizedBox(height: 16),
                _fact(context, Icons.event_outlined, 'Starts', formatWhen(c.startsAt)),
                _fact(context, Icons.how_to_reg_outlined, 'Registration closes', formatWhen(c.registrationClosesAt)),
                _fact(context, Icons.place_outlined, 'Venue', '${c.venue}, ${c.city}'),
                _fact(
                  context,
                  Icons.groups_outlined,
                  'Players',
                  '${c.registeredCount} of ${c.maxParticipants}${t.waitlistedCount > 0 ? ' · ${t.waitlistedCount} waiting' : ''}',
                ),
                _fact(context, Icons.payments_outlined, 'Entry fee', c.entryFee == 0 ? 'Free' : formatPKR(c.entryFee)),
                if (t.prizeInfo != null) _fact(context, Icons.emoji_events_outlined, 'Prize', t.prizeInfo!),
                if (t.organizerContact != null)
                  _fact(context, Icons.call_outlined, 'Organizer contact', t.organizerContact!),
                const SizedBox(height: 12),
                Text('About', style: theme.textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(t.description),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _fact(BuildContext context, IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodySmall),
              Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    ),
  );
}

class _RegistrationCard extends ConsumerStatefulWidget {
  const _RegistrationCard({required this.t});
  final TournamentDetailData t;

  @override
  ConsumerState<_RegistrationCard> createState() => _RegistrationCardState();
}

class _RegistrationCardState extends ConsumerState<_RegistrationCard> {
  bool _busy = false;

  Future<void> _register() async {
    if (!ensureSignedIn(context, ref)) return;
    final t = widget.t;
    var accepted = false;
    DateTime? dob;
    var askDob = false;
    final repo = ref.read(tournamentsRepositoryProvider);

    while (true) {
      if (!mounted) return;
      final ok = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (c) => StatefulBuilder(
          builder: (c, set) => Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Register for ${t.card.name}', style: Theme.of(c).textTheme.titleLarge),
                const SizedBox(height: 10),
                Text('Players must be at least ${t.card.minAge}. Approved materials: ${t.approvedMaterials}'),
                if (askDob) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.cake_outlined),
                    label: Text(dob == null ? 'Choose your date of birth' : '${dob!.day}/${dob!.month}/${dob!.year}'),
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: c,
                        firstDate: DateTime(1930),
                        lastDate: DateTime.now(),
                        initialDate: DateTime(2000),
                      );
                      if (picked != null) set(() => dob = picked);
                    },
                  ),
                ],
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: accepted,
                  onChanged: (v) => set(() => accepted = v ?? false),
                  title: const Text(
                    'I have read the rules and safety requirements, and I will use only the approved materials.',
                  ),
                ),
                FilledButton(
                  onPressed: accepted && (!askDob || dob != null) ? () => Navigator.pop(c, true) : null,
                  child: const Text('Confirm registration'),
                ),
              ],
            ),
          ),
        ),
      );
      if (ok != true || !mounted) return;
      setState(() => _busy = true);
      try {
        final msg = await repo.register(t.card.slug, dateOfBirth: dob?.toUtc().toIso8601String());
        ref.invalidate(tournamentProvider(t.card.slug));
        if (mounted) showToast(context, msg, kind: ToastKind.success);
        return;
      } on ApiException catch (e) {
        if (!mounted) return;
        if (e.code == 'DOB_REQUIRED') {
          askDob = true;
          continue; // reopen the sheet asking for the date of birth
        }
        showToast(context, e.message, kind: ToastKind.error);
        return;
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }
  }

  Future<void> _withdraw() async {
    setState(() => _busy = true);
    try {
      await ref.read(tournamentsRepositoryProvider).withdraw(widget.t.card.slug);
      ref.invalidate(tournamentProvider(widget.t.card.slug));
      if (mounted) showToast(context, 'You have withdrawn.');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final theme = Theme.of(context);
    final status = t.myStatus;
    if (status != null && status != 'WITHDRAWN') {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Your registration', style: theme.textTheme.titleMedium),
              const SizedBox(height: 6),
              StatusPill(
                participantStatusLabels[status] ?? status,
                status == 'CONFIRMED'
                    ? AppColors.success
                    : (status == 'PENDING' || status == 'WAITLISTED')
                    ? AppColors.warning
                    : AppColors.danger,
              ),
              if (t.myPlacement != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('Final result: ${placementLabel(t.myPlacement)}'),
                ),
              if (t.myStatusNote != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(t.myStatusNote!, style: theme.textTheme.bodySmall),
                ),
              if (t.card.status == 'PUBLISHED' && const ['PENDING', 'CONFIRMED', 'WAITLISTED'].contains(status)) ...[
                const SizedBox(height: 10),
                OutlinedButton(onPressed: _busy ? null : _withdraw, child: const Text('Withdraw')),
              ],
            ],
          ),
        ),
      );
    }
    if (!t.card.registrationOpen) {
      return Card(
        child: ListTile(
          leading: const Icon(Icons.lock_clock_outlined),
          title: const Text('Registration'),
          subtitle: Text(t.card.status == 'PUBLISHED' ? 'Not open right now.' : 'Registration is closed.'),
        ),
      );
    }
    final full = t.card.registeredCount >= t.card.maxParticipants;
    return LoadingButton(label: full ? 'Join the waiting list' : 'Register now', loading: _busy, onPressed: _register);
  }
}

class _Rules extends StatelessWidget {
  const _Rules({required this.t});
  final TournamentDetailData t;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Widget section(String title, String body) => Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(body),
        ],
      ),
    );
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: theme.colorScheme.primaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.verified_user_outlined, color: theme.colorScheme.primary),
                    const SizedBox(width: 8),
                    Text('Safety and eligibility', style: theme.textTheme.titleMedium),
                  ],
                ),
                const SizedBox(height: 8),
                Text(t.safetyRules),
                const SizedBox(height: 8),
                Text('Approved materials: ${t.approvedMaterials}'),
                Text('Minimum age: ${t.card.minAge}'),
                if (t.venueRestrictions != null) Text('Venue: ${t.venueRestrictions}'),
                if (t.permitReference != null)
                  Text('Local permission: ${t.permitReference}', style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        section('Competition rules', t.rules),
      ],
    );
  }
}

class _Players extends ConsumerWidget {
  const _Players({required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) => AsyncBody(
    value: ref.watch(participantsProvider(slug)),
    onRetry: () => ref.invalidate(participantsProvider(slug)),
    builder: (list) {
      if (list.isEmpty) {
        return const EmptyState(
          icon: Icons.groups_outlined,
          title: 'No confirmed players yet',
          message: 'Confirmed players appear here.',
        );
      }
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        separatorBuilder: (_, _) => const Divider(),
        itemBuilder: (_, i) {
          final p = list[i];
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(child: Text(p.name[0].toUpperCase())),
            title: Text(p.name),
            subtitle: Text([p.city, if (p.seed != null) 'Seed ${p.seed}'].whereType<String>().join(' · ')),
            trailing: p.placement != null ? Text(placementLabel(p.placement)) : null,
            onTap: () => context.push('/player/${p.userId}'),
          );
        },
      );
    },
  );
}

class _Bracket extends ConsumerWidget {
  const _Bracket({required this.slug, required this.myEntryId});
  final String slug;
  final String? myEntryId;

  Future<void> _dispute(BuildContext context, WidgetRef ref, MatchData m) async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Dispute this match'),
        content: TextField(
          controller: reason,
          maxLines: 3,
          maxLength: 1000,
          decoration: const InputDecoration(labelText: 'What went wrong?'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Send')),
        ],
      ),
    );
    final text = reason.text.trim();
    reason.dispose();
    if (ok != true) return;
    try {
      await ref.read(tournamentsRepositoryProvider).dispute(m.id, text);
      ref.invalidate(bracketProvider(slug));
      if (context.mounted) {
        showToast(context, 'Dispute sent. A tournament manager will review it.', kind: ToastKind.success);
      }
    } on ApiException catch (e) {
      if (context.mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return AsyncBody(
      value: ref.watch(bracketProvider(slug)),
      onRetry: () => ref.invalidate(bracketProvider(slug)),
      builder: (rounds) {
        if (rounds.isEmpty) {
          return const EmptyState(
            icon: Icons.account_tree_outlined,
            title: 'No bracket yet',
            message: 'It appears once the organizer draws it.',
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(bracketProvider(slug).future),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              for (final r in rounds) ...[
                Text(r.name, style: theme.textTheme.titleLarge),
                const SizedBox(height: 8),
                for (final m in r.matches)
                  _MatchCard(
                    m: m,
                    mine:
                        myEntryId != null &&
                        (m.playerA?.participantId == myEntryId || m.playerB?.participantId == myEntryId),
                    onDispute: () => _dispute(context, ref, m),
                  ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _MatchCard extends StatelessWidget {
  const _MatchCard({required this.m, required this.mine, required this.onDispute});
  final MatchData m;
  final bool mine;
  final VoidCallback onDispute;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Widget line(MatchPlayerData? p, int? score) {
      final won = m.winnerId != null && p != null && m.winnerId == p.participantId;
      return Row(
        children: [
          Expanded(
            child: Text(
              p?.name ?? 'To be decided',
              style: TextStyle(
                fontWeight: won ? FontWeight.w700 : FontWeight.w400,
                fontStyle: p == null ? FontStyle.italic : null,
                color: m.winnerId != null && !won ? theme.colorScheme.onSurfaceVariant : null,
              ),
            ),
          ),
          Text(score?.toString() ?? (won ? '✓' : '')),
        ],
      );
    }

    final live = m.status == 'LIVE';
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: live ? AppColors.danger : theme.colorScheme.outline),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Match ${m.matchNumber}', style: theme.textTheme.bodySmall),
                const Spacer(),
                Text(
                  m.isBye
                      ? 'Bye'
                      : live
                      ? '● Live'
                      : m.status[0] + m.status.substring(1).toLowerCase().replaceAll('_', '-'),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: live ? AppColors.danger : null,
                    fontWeight: live ? FontWeight.w700 : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            line(m.playerA, m.scoreA),
            const Divider(height: 12),
            line(m.playerB, m.scoreB),
            if (m.scheduledAt != null && m.winnerId == null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  [formatWhen(m.scheduledAt!), m.location].whereType<String>().join(' · '),
                  style: theme.textTheme.bodySmall,
                ),
              ),
            if (mine && (m.status == 'LIVE' || m.status == 'COMPLETED') && !m.isBye)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(onPressed: onDispute, child: const Text('Dispute')),
              ),
          ],
        ),
      ),
    );
  }
}
