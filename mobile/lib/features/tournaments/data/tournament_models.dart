/// Tournament models. Mirror backend/src/modules/tournaments responses.
library;

import '../../../core/i18n/i18n.dart';

DateTime _date(Object? v) => DateTime.parse(v as String).toLocal();

class TournamentCardData {
  const TournamentCardData({
    required this.id,
    required this.slug,
    required this.name,
    required this.city,
    required this.venue,
    required this.startsAt,
    required this.registrationClosesAt,
    required this.status,
    required this.maxParticipants,
    required this.registeredCount,
    required this.entryFee,
    required this.minAge,
    required this.registrationOpen,
    required this.organizerName,
  });

  final String id;
  final String slug;
  final String name;
  final String city;
  final String venue;
  final DateTime startsAt;
  final DateTime registrationClosesAt;
  final String status;
  final int maxParticipants;
  final int registeredCount;
  final int entryFee;
  final int minAge;
  final bool registrationOpen;
  final String organizerName;

  factory TournamentCardData.fromJson(Map<String, dynamic> j) => TournamentCardData(
    id: j['id'] as String,
    slug: j['slug'] as String,
    name: j['name'] as String,
    city: j['city'] as String,
    venue: j['venue'] as String,
    startsAt: _date(j['startsAt']),
    registrationClosesAt: _date(j['registrationClosesAt']),
    status: j['status'] as String,
    maxParticipants: j['maxParticipants'] as int,
    registeredCount: j['registeredCount'] as int,
    entryFee: j['entryFee'] as int,
    minAge: j['minAge'] as int,
    registrationOpen: j['registrationOpen'] as bool,
    organizerName: j['organizerName'] as String,
  );
}

class TournamentDetailData {
  const TournamentDetailData({
    required this.card,
    required this.description,
    required this.rules,
    required this.safetyRules,
    required this.approvedMaterials,
    required this.venueRestrictions,
    required this.permitReference,
    required this.prizeInfo,
    required this.organizerContact,
    required this.cancelReason,
    required this.waitlistedCount,
    required this.myEntryId,
    required this.myStatus,
    required this.myStatusNote,
    required this.myPlacement,
    required this.championName,
    required this.championUserId,
  });

  final TournamentCardData card;
  final String description;
  final String rules;
  final String safetyRules;
  final String approvedMaterials;
  final String? venueRestrictions;
  final String? permitReference;
  final String? prizeInfo;
  final String? organizerContact;
  final String? cancelReason;
  final int waitlistedCount;
  final String? myEntryId;
  final String? myStatus;
  final String? myStatusNote;
  final int? myPlacement;
  final String? championName;
  final String? championUserId;

  factory TournamentDetailData.fromJson(Map<String, dynamic> j) {
    final entry = j['myEntry'] as Map?;
    final champ = j['champion'] as Map?;
    return TournamentDetailData(
      card: TournamentCardData.fromJson(j),
      description: j['description'] as String,
      rules: j['rules'] as String,
      safetyRules: j['safetyRules'] as String,
      approvedMaterials: j['approvedMaterials'] as String,
      venueRestrictions: j['venueRestrictions'] as String?,
      permitReference: j['permitReference'] as String?,
      prizeInfo: j['prizeInfo'] as String?,
      organizerContact: j['organizerContact'] as String?,
      cancelReason: j['cancelReason'] as String?,
      waitlistedCount: j['waitlistedCount'] as int,
      myEntryId: entry?['id'] as String?,
      myStatus: entry?['status'] as String?,
      myStatusNote: entry?['statusNote'] as String?,
      myPlacement: entry?['finalPlacement'] as int?,
      championName: champ?['name'] as String?,
      championUserId: champ?['userId'] as String?,
    );
  }
}

class MatchPlayerData {
  const MatchPlayerData(this.participantId, this.userId, this.name, this.seed);
  final String participantId;
  final String userId;
  final String name;
  final int? seed;

  static MatchPlayerData? fromJson(Object? j) => j is Map
      ? MatchPlayerData(j['participantId'] as String, j['userId'] as String, j['name'] as String, j['seed'] as int?)
      : null;
}

class MatchData {
  const MatchData({
    required this.id,
    required this.round,
    required this.roundName,
    required this.matchNumber,
    required this.status,
    required this.isBye,
    required this.isWalkover,
    required this.playerA,
    required this.playerB,
    required this.winnerId,
    required this.scoreA,
    required this.scoreB,
    required this.scheduledAt,
    required this.location,
    required this.tournamentName,
    required this.tournamentSlug,
  });

  final String id;
  final int round;
  final String? roundName;
  final int matchNumber;
  final String status;
  final bool isBye;
  final bool isWalkover;
  final MatchPlayerData? playerA;
  final MatchPlayerData? playerB;
  final String? winnerId;
  final int? scoreA;
  final int? scoreB;
  final DateTime? scheduledAt;
  final String? location;
  final String tournamentName;
  final String tournamentSlug;

  factory MatchData.fromJson(Map<String, dynamic> j) => MatchData(
    id: j['id'] as String,
    round: j['round'] as int,
    roundName: j['roundName'] as String?,
    matchNumber: j['matchNumber'] as int,
    status: j['status'] as String,
    isBye: j['isBye'] as bool,
    isWalkover: j['isWalkover'] as bool,
    playerA: MatchPlayerData.fromJson(j['playerA']),
    playerB: MatchPlayerData.fromJson(j['playerB']),
    winnerId: j['winnerId'] as String?,
    scoreA: j['scoreA'] as int?,
    scoreB: j['scoreB'] as int?,
    scheduledAt: j['scheduledAt'] == null ? null : _date(j['scheduledAt']),
    location: j['location'] as String?,
    tournamentName: (j['tournament'] as Map)['name'] as String,
    tournamentSlug: (j['tournament'] as Map)['slug'] as String,
  );
}

class RankingRowData {
  const RankingRowData(
    this.rank,
    this.userId,
    this.name,
    this.city,
    this.points,
    this.matches,
    this.wins,
    this.winRate,
    this.championships,
  );
  final int rank;
  final String userId;
  final String name;
  final String? city;
  final int points;
  final int matches;
  final int wins;
  final int? winRate;
  final int championships;

  factory RankingRowData.fromJson(Map<String, dynamic> j) {
    final p = j['player'] as Map;
    return RankingRowData(
      j['rank'] as int,
      p['userId'] as String,
      p['name'] as String,
      p['city'] as String?,
      j['points'] as int,
      j['matches'] as int,
      j['wins'] as int,
      j['winRate'] as int?,
      j['championships'] as int,
    );
  }
}

class PlayerProfileData {
  const PlayerProfileData({
    required this.name,
    required this.city,
    required this.bio,
    required this.stats,
    required this.badges,
    required this.results,
  });

  final String name;
  final String? city;
  final String? bio;
  final Map<String, dynamic> stats;
  final List<({String label, String description})> badges;
  final List<({String slug, String name, int placement, int points, int wins, int losses})> results;

  factory PlayerProfileData.fromJson(Map<String, dynamic> j) => PlayerProfileData(
    name: (j['player'] as Map)['name'] as String,
    city: (j['player'] as Map)['city'] as String?,
    bio: (j['player'] as Map)['bio'] as String?,
    stats: (j['stats'] as Map).cast<String, dynamic>(),
    badges: [
      for (final b in (j['badges'] as List))
        (label: (b as Map)['label'] as String, description: b['description'] as String),
    ],
    results: [
      for (final r in (j['results'] as List))
        (
          slug: ((r as Map)['tournament'] as Map)['slug'] as String,
          name: (r['tournament'] as Map)['name'] as String,
          placement: r['placement'] as int,
          points: r['points'] as int,
          wins: r['wins'] as int,
          losses: r['losses'] as int,
        ),
    ],
  );
}

String placementLabel(int? p) => switch (p) {
  null => '—',
  1 => 'Champion'.tr,
  2 => 'Runner-up'.tr,
  3 => 'Semi-finalist'.tr,
  5 => 'Quarter-finalist'.tr,
  _ => 'Top {p}'.trf({'p': (p - 1) * 2}),
};

const participantStatusLabels = {
  'PENDING': 'Spot held (fee pending)',
  'CONFIRMED': 'Confirmed',
  'WAITLISTED': 'Waiting list',
  'WITHDRAWN': 'Withdrawn',
  'REJECTED': 'Not accepted',
  'DISQUALIFIED': 'Disqualified',
};
