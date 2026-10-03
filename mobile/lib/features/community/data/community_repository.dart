import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../marketplace/data/models.dart' show PageResult;

class AuthorData {
  const AuthorData(this.id, this.name, this.city);
  final String id;
  final String name;
  final String? city;

  factory AuthorData.fromJson(Map j) => AuthorData(j['id'] as String, j['name'] as String, j['city'] as String?);
}

class PostData {
  const PostData({
    required this.id,
    required this.body,
    required this.createdAt,
    required this.edited,
    required this.author,
    required this.media,
    required this.likeCount,
    required this.commentCount,
    required this.shareCount,
    required this.likedByMe,
    required this.isMine,
  });

  final String id;
  final String body;
  final DateTime createdAt;
  final bool edited;
  final AuthorData author;
  final List<({String kind, String url})> media;
  final int likeCount;
  final int commentCount;
  final int shareCount;
  final bool likedByMe;
  final bool isMine;

  PostData copyWith({String? body, int? likeCount, bool? likedByMe, int? shareCount, bool? edited}) => PostData(
    id: id,
    body: body ?? this.body,
    createdAt: createdAt,
    edited: edited ?? this.edited,
    author: author,
    media: media,
    likeCount: likeCount ?? this.likeCount,
    commentCount: commentCount,
    shareCount: shareCount ?? this.shareCount,
    likedByMe: likedByMe ?? this.likedByMe,
    isMine: isMine,
  );

  factory PostData.fromJson(Map<String, dynamic> j) => PostData(
    id: j['id'] as String,
    body: j['body'] as String,
    createdAt: DateTime.parse(j['createdAt'] as String).toLocal(),
    edited: j['editedAt'] != null,
    author: AuthorData.fromJson(j['author'] as Map),
    media: [for (final m in (j['media'] as List)) (kind: (m as Map)['kind'] as String, url: m['url'] as String)],
    likeCount: j['likeCount'] as int,
    commentCount: j['commentCount'] as int,
    shareCount: j['shareCount'] as int,
    likedByMe: j['likedByMe'] as bool,
    isMine: j['isMine'] as bool,
  );
}

class CommentData {
  const CommentData(this.id, this.body, this.createdAt, this.author, this.isMine, this.replies);
  final String id;
  final String body;
  final DateTime createdAt;
  final AuthorData author;
  final bool isMine;
  final List<CommentData> replies;

  factory CommentData.fromJson(Map j) => CommentData(
    j['id'] as String,
    j['body'] as String,
    DateTime.parse(j['createdAt'] as String).toLocal(),
    AuthorData.fromJson(j['author'] as Map),
    j['isMine'] as bool,
    [for (final r in (j['replies'] as List? ?? [])) CommentData.fromJson(r as Map)],
  );
}

class CommunityProfileData {
  const CommunityProfileData(
    this.author,
    this.bio,
    this.followers,
    this.following,
    this.posts,
    this.isFollowing,
    this.isBlocked,
    this.isMe,
  );
  final AuthorData author;
  final String? bio;
  final int followers;
  final int following;
  final int posts;
  final bool isFollowing;
  final bool isBlocked;
  final bool isMe;

  factory CommunityProfileData.fromJson(Map<String, dynamic> j) => CommunityProfileData(
    AuthorData.fromJson(j),
    j['bio'] as String?,
    j['followers'] as int,
    j['following'] as int,
    j['posts'] as int,
    j['isFollowing'] as bool,
    j['isBlocked'] as bool,
    j['isMe'] as bool,
  );
}

const reportReasons = {
  'spam': 'Spam or scam',
  'harassment': 'Harassment or hate',
  'dangerous': 'Dangerous or illegal kite materials',
  'inappropriate': 'Inappropriate content',
  'misinformation': 'False information',
  'other': 'Something else',
};

String timeAgo(DateTime d) {
  final s = DateTime.now().difference(d).inSeconds;
  if (s < 60) return 'just now';
  if (s < 3600) return '${s ~/ 60}m';
  if (s < 86400) return '${s ~/ 3600}h';
  if (s < 7 * 86400) return '${s ~/ 86400}d';
  return '${d.day}/${d.month}/${d.year}';
}

class CommunityRepository {
  CommunityRepository(this._api);
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

  Future<PageResult<PostData>> feed({required String scope, int page = 1}) =>
      _page('/feed', {'scope': scope, 'page': page, 'pageSize': 15}, PostData.fromJson);

  Future<PageResult<PostData>> userPosts(String userId, {int page = 1}) =>
      _page('/community/users/$userId/posts', {'page': page, 'pageSize': 15}, PostData.fromJson);

  Future<PostData> post(String id) async =>
      PostData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/posts/$id'));

  /// Uploads a photo or video for a post and returns its upload id.
  Future<String> uploadMedia(String path, String filename) async {
    try {
      final res = await _api.dio.post<Map<String, dynamic>>(
        '/uploads',
        queryParameters: {'purpose': 'post_media'},
        data: FormData.fromMap({'file': await MultipartFile.fromFile(path, filename: filename)}),
      );
      return (res.data!['data'] as Map)['id'] as String;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> createPost(String body, List<String> mediaUploadIds) =>
      _api.request<Map<String, dynamic>>('POST', '/posts', body: {'body': body, 'mediaUploadIds': mediaUploadIds});

  Future<void> editPost(String id, String body) =>
      _api.request<Map<String, dynamic>>('PATCH', '/posts/$id', body: {'body': body});

  Future<void> deletePost(String id) => _api.request<Map<String, dynamic>>('DELETE', '/posts/$id');

  Future<({bool liked, int likeCount})> setLike(String id, bool like) async {
    final r = await _api.request<Map<String, dynamic>>(like ? 'PUT' : 'DELETE', '/posts/$id/like');
    return (liked: r['liked'] as bool, likeCount: r['likeCount'] as int);
  }

  Future<({String path, int shareCount})> share(String id) async {
    final r = await _api.request<Map<String, dynamic>>('POST', '/posts/$id/share');
    return (path: r['path'] as String, shareCount: r['shareCount'] as int);
  }

  Future<List<CommentData>> comments(String postId) async {
    final page = await _page('/posts/$postId/comments', {'pageSize': 100}, CommentData.fromJson);
    return page.items;
  }

  Future<void> comment(String postId, String body, {String? parentId}) => _api.request<Map<String, dynamic>>(
    'POST',
    '/posts/$postId/comments',
    body: {'body': body, 'parentId': ?parentId},
  );

  Future<void> deleteComment(String id) => _api.request<Map<String, dynamic>>('DELETE', '/comments/$id');

  Future<CommunityProfileData> profile(String userId) async =>
      CommunityProfileData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/community/users/$userId'));

  Future<void> setFollow(String userId, bool follow) =>
      _api.request<Map<String, dynamic>>(follow ? 'PUT' : 'DELETE', '/community/users/$userId/follow');

  Future<void> setBlock(String userId, bool block) =>
      _api.request<Map<String, dynamic>>(block ? 'PUT' : 'DELETE', '/community/users/$userId/block');

  Future<void> report(String targetType, String targetId, String reason, String? details) =>
      _api.request<Map<String, dynamic>>(
        'POST',
        '/reports',
        body: {'targetType': targetType, 'targetId': targetId, 'reason': reason, 'details': ?details},
      );
}

final communityRepositoryProvider = Provider((ref) => CommunityRepository(ref.watch(apiClientProvider)));

final postProvider = FutureProvider.autoDispose.family<PostData, String>(
  (ref, id) => ref.watch(communityRepositoryProvider).post(id),
);

final commentsProvider = FutureProvider.autoDispose.family<List<CommentData>, String>(
  (ref, id) => ref.watch(communityRepositoryProvider).comments(id),
);

final communityProfileProvider = FutureProvider.autoDispose.family<CommunityProfileData, String>(
  (ref, id) => ref.watch(communityRepositoryProvider).profile(id),
);
