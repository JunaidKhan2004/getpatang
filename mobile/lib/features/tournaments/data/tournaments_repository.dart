import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../marketplace/data/models.dart' show PageResult;
import 'tournament_models.dart';

class TournamentsRepository {
  TournamentsRepository(this._api);
  final ApiClient _api;

  Future<PageResult<T>> _page<T>(
    String path,
    Map<String, dynamic> query,
    T Function(Map<String, dynamic>) parse,
  ) async {
    try {
      final res = await _api.dio.get<Map<String, dynamic>>(path, queryParameters: query);
      final meta = res.data!['meta'] as Map<String, dynamic>;
      return PageResult(
        [for (final j in (res.data!['data'] as List)) parse(j as Map<String, dynamic>)],
        meta['page'] as int,
        meta['totalPages'] as int,
        meta['total'] as int,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<PageResult<TournamentCardData>> list({String? view, String? city, int page = 1}) =>
      _page('/tournaments', {'view': ?view, 'city': ?city, 'page': page, 'pageSize': 20}, TournamentCardData.fromJson);

  Future<TournamentDetailData> detail(String slug) async =>
      TournamentDetailData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/tournaments/$slug'));

  Future<List<({String userId, String name, String? city, int? seed, int? placement})>> participants(
    String slug,
  ) async => [
    for (final p in await _api.request<List<dynamic>>('GET', '/tournaments/$slug/participants', auth: false))
      (
        userId: ((p as Map)['player'] as Map)['userId'] as String,
        name: (p['player'] as Map)['name'] as String,
        city: (p['player'] as Map)['city'] as String?,
        seed: p['seed'] as int?,
        placement: p['finalPlacement'] as int?,
      ),
  ];

  Future<List<({String name, List<MatchData> matches})>> bracket(String slug) async {
    final res = await _api.request<Map<String, dynamic>>('GET', '/tournaments/$slug/bracket', auth: false);
    return [
      for (final r in (res['rounds'] as List))
        (
          name: (r as Map)['name'] as String,
          matches: [for (final m in (r['matches'] as List)) MatchData.fromJson(m as Map<String, dynamic>)],
        ),
    ];
  }

  Future<String> register(String slug, {String? dateOfBirth}) async {
    final res = await _api.request<Map<String, dynamic>>(
      'POST',
      '/tournaments/$slug/registration',
      body: {'acceptRules': true, 'dateOfBirth': ?dateOfBirth},
    );
    return res['message'] as String;
  }

  Future<void> withdraw(String slug) => _api.request<Map<String, dynamic>>('DELETE', '/tournaments/$slug/registration');

  Future<void> dispute(String matchId, String reason) =>
      _api.request<Map<String, dynamic>>('POST', '/matches/$matchId/dispute', body: {'reason': reason});

  Future<List<({String status, String? note, int? placement, TournamentCardData tournament})>> mine() async => [
    for (final e in await _api.request<List<dynamic>>('GET', '/tournaments/mine'))
      (
        status: (e as Map)['status'] as String,
        note: e['statusNote'] as String?,
        placement: e['finalPlacement'] as int?,
        tournament: TournamentCardData.fromJson(e['tournament'] as Map<String, dynamic>),
      ),
  ];

  Future<PageResult<RankingRowData>> rankings({String? season, String? city, int page = 1}) =>
      _page('/rankings', {'season': ?season, 'city': ?city, 'page': page, 'pageSize': 50}, RankingRowData.fromJson);

  Future<({List<String> seasons, List<String> cities})> rankingFilters() async {
    final res = await _api.request<Map<String, dynamic>>('GET', '/rankings/filters', auth: false);
    return (seasons: (res['seasons'] as List).cast<String>(), cities: (res['cities'] as List).cast<String>());
  }

  Future<PlayerProfileData> player(String userId) async =>
      PlayerProfileData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/players/$userId', auth: false));
}

final tournamentsRepositoryProvider = Provider((ref) => TournamentsRepository(ref.watch(apiClientProvider)));

final tournamentProvider = FutureProvider.autoDispose.family<TournamentDetailData, String>(
  (ref, slug) => ref.watch(tournamentsRepositoryProvider).detail(slug),
);

final playerProvider = FutureProvider.autoDispose.family<PlayerProfileData, String>(
  (ref, id) => ref.watch(tournamentsRepositoryProvider).player(id),
);

final participantsProvider = FutureProvider.autoDispose.family(
  (ref, String slug) => ref.watch(tournamentsRepositoryProvider).participants(slug),
);

final bracketProvider = FutureProvider.autoDispose.family(
  (ref, String slug) => ref.watch(tournamentsRepositoryProvider).bracket(slug),
);

final myTournamentsProvider = FutureProvider.autoDispose((ref) => ref.watch(tournamentsRepositoryProvider).mine());
