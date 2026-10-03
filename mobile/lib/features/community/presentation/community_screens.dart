import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/network/api_client.dart';
import '../../../core/widgets/feedback.dart';
import '../../auth/application/auth_controller.dart';
import '../../marketplace/presentation/product_screen.dart' show ensureSignedIn;
import '../../marketplace/data/models.dart' show PageResult;
import '../../marketplace/widgets/market_widgets.dart';
import '../../shell/main_shell.dart';
import '../data/community_repository.dart';
import 'community_widgets.dart';
import '../../../core/widgets/loaders.dart';

class CommunityTab extends ConsumerStatefulWidget {
  const CommunityTab({super.key});

  @override
  ConsumerState<CommunityTab> createState() => _CommunityTabState();
}

class _CommunityTabState extends ConsumerState<CommunityTab> {
  String _scope = 'latest';
  int _refresh = 0;

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(authControllerProvider) is Authenticated;
    final repo = ref.watch(communityRepositoryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Community'), actions: const [GlobalActions()]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          if (!ensureSignedIn(context, ref)) return;
          final posted = await context.push<bool>('/compose');
          if (posted == true) setState(() => _refresh++);
        },
        icon: const Icon(Icons.edit_outlined),
        label: const Text('Post'),
      ),
      body: Column(
        children: [
          if (signedIn)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'latest', label: Text('Latest')),
                  ButtonSegment(value: 'following', label: Text('Following')),
                ],
                selected: {_scope},
                onSelectionChanged: (s) => setState(() => _scope = s.first),
              ),
            ),
          Expanded(
            child: PagedView<PostData>(
              key: ValueKey('$_scope|$_refresh'),
              fetch: (page) => repo.feed(scope: _scope, page: page),
              itemBuilder: (_, p) => PostTile(post: p),
              empty: EmptyState(
                icon: Icons.groups_outlined,
                title: _scope == 'following' ? 'Nothing from people you follow' : 'No posts yet',
                message: _scope == 'following'
                    ? 'Follow flyers from the Latest feed to see them here.'
                    : 'Be the first to share something.',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ComposeScreen extends ConsumerStatefulWidget {
  const ComposeScreen({super.key});

  @override
  ConsumerState<ComposeScreen> createState() => _ComposeScreenState();
}

class _ComposeScreenState extends ConsumerState<ComposeScreen> {
  final _body = TextEditingController();
  final _picker = ImagePicker();
  final List<({XFile file, bool video})> _media = [];
  bool _posting = false;

  @override
  void dispose() {
    _body.dispose();
    super.dispose();
  }

  bool get _hasVideo => _media.any((m) => m.video);

  Future<void> _pickPhotos() async {
    final files = await _picker.pickMultiImage(imageQuality: 85, maxWidth: 2048, limit: 4 - _media.length);
    setState(() => _media.addAll(files.take(4 - _media.length).map((f) => (file: f, video: false))));
  }

  Future<void> _pickVideo() async {
    final f = await _picker.pickVideo(source: ImageSource.gallery, maxDuration: const Duration(minutes: 2));
    if (f != null) setState(() => _media.add((file: f, video: true)));
  }

  Future<void> _post() async {
    final text = _body.text.trim();
    if (text.isEmpty) return;
    setState(() => _posting = true);
    final repo = ref.read(communityRepositoryProvider);
    try {
      final ids = <String>[];
      for (final m in _media) {
        ids.add(await repo.uploadMedia(m.file.path, m.file.name));
      }
      await repo.createPost(text, ids);
      if (!mounted) return;
      showToast(context, 'Posted.', kind: ToastKind.success);
      context.pop(true);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('New post'),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: _posting
              ? const Center(child: KiteSpinner(size: 22))
              : FilledButton(
                  style: FilledButton.styleFrom(minimumSize: const Size(72, 40)),
                  onPressed: _post,
                  child: const Text('Post'),
                ),
        ),
      ],
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _body,
          autofocus: true,
          maxLength: 2000,
          maxLines: 8,
          minLines: 4,
          decoration: const InputDecoration(hintText: 'Share a flight, a kite you made, or a tip…'),
        ),
        if (_media.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (i, m) in _media.indexed)
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: m.video
                          ? Container(
                              width: 90,
                              height: 90,
                              color: Colors.black,
                              child: const Icon(Icons.videocam, color: Colors.white),
                            )
                          : Image.file(File(m.file.path), width: 90, height: 90, fit: BoxFit.cover),
                    ),
                    Positioned(
                      right: 0,
                      top: 0,
                      child: IconButton.filledTonal(
                        tooltip: 'Remove',
                        visualDensity: VisualDensity.compact,
                        onPressed: () => setState(() => _media.removeAt(i)),
                        icon: const Icon(Icons.close, size: 16),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        const SizedBox(height: 8),
        Row(
          children: [
            TextButton.icon(
              onPressed: _hasVideo || _media.length >= 4 || _posting ? null : _pickPhotos,
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('Photos'),
            ),
            TextButton.icon(
              onPressed: _media.isNotEmpty || _posting ? null : _pickVideo,
              icon: const Icon(Icons.videocam_outlined),
              label: const Text('Video'),
            ),
          ],
        ),
        Text(
          'Up to 4 photos or one video (50 MB). Posts promoting banned strings or unsafe flying are removed.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    ),
  );
}

class PostScreen extends ConsumerStatefulWidget {
  const PostScreen({super.key, required this.postId});
  final String postId;

  @override
  ConsumerState<PostScreen> createState() => _PostScreenState();
}

class _PostScreenState extends ConsumerState<PostScreen> {
  final _comment = TextEditingController();
  CommentData? _replyTo;
  bool _sending = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!ensureSignedIn(context, ref)) return;
    final text = _comment.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(communityRepositoryProvider).comment(widget.postId, text, parentId: _replyTo?.id);
      _comment.clear();
      setState(() => _replyTo = null);
      ref.invalidate(commentsProvider(widget.postId));
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _deleteComment(CommentData c) async {
    try {
      await ref.read(communityRepositoryProvider).deleteComment(c.id);
      ref.invalidate(commentsProvider(widget.postId));
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  Widget _commentTile(CommentData c, bool postIsMine, {bool isReply = false}) {
    final t = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(left: isReply ? 44 : 0, top: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () => context.push('/u/${c.author.id}'),
            child: CircleAvatar(radius: 16, child: Text(c.author.name[0].toUpperCase())),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: t.colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.author.name, style: t.textTheme.titleMedium?.copyWith(fontSize: 13)),
                      Text(c.body),
                    ],
                  ),
                ),
                Wrap(
                  spacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(timeAgo(c.createdAt), style: t.textTheme.bodySmall),
                    if (!isReply) TextButton(onPressed: () => setState(() => _replyTo = c), child: const Text('Reply')),
                    if (c.isMine || postIsMine)
                      TextButton(onPressed: () => _deleteComment(c), child: const Text('Delete')),
                    if (!c.isMine)
                      TextButton(
                        onPressed: () => showReportSheet(context, ref, 'comment', c.id),
                        child: const Text('Report'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final post = ref.watch(postProvider(widget.postId));
    final comments = ref.watch(commentsProvider(widget.postId));
    return Scaffold(
      appBar: AppBar(title: const Text('Post')),
      body: AsyncBody(
        value: post,
        onRetry: () => ref.invalidate(postProvider(widget.postId)),
        builder: (p) => Column(
          children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(commentsProvider(widget.postId));
                  await ref.read(postProvider(widget.postId).future);
                },
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    PostTile(post: p, openOnTap: false, onDeleted: () => context.pop()),
                    const SizedBox(height: 8),
                    Text('Comments', style: Theme.of(context).textTheme.titleLarge),
                    comments.when(
                      loading: () => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Column(
                          children: [
                            for (var i = 0; i < 3; i++)
                              const Padding(padding: EdgeInsets.only(bottom: 10), child: ListRowSkeleton(kite: false)),
                          ],
                        ),
                      ),
                      error: (_, _) =>
                          const Padding(padding: EdgeInsets.all(16), child: Text('Comments could not load.')),
                      data: (list) => list.isEmpty
                          ? const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Text('No comments yet.'))
                          : Column(
                              children: [
                                for (final c in list) ...[
                                  _commentTile(c, p.isMine),
                                  for (final r in c.replies) _commentTile(r, p.isMine, isReply: true),
                                ],
                              ],
                            ),
                    ),
                  ],
                ),
              ),
            ),
            SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outline)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_replyTo != null)
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Replying to ${_replyTo!.author.name}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                          IconButton(
                            tooltip: 'Cancel reply',
                            onPressed: () => setState(() => _replyTo = null),
                            icon: const Icon(Icons.close, size: 18),
                          ),
                        ],
                      ),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _comment,
                            maxLength: 1000,
                            minLines: 1,
                            maxLines: 4,
                            decoration: const InputDecoration(
                              hintText: 'Write a comment…',
                              counterText: '',
                              isDense: true,
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Send',
                          onPressed: _sending ? null : _send,
                          icon: _sending ? const KiteSpinner(size: 20) : const Icon(Icons.send),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CommunityProfileScreen extends ConsumerWidget {
  const CommunityProfileScreen({super.key, required this.userId});
  final String userId;

  Future<void> _run(BuildContext context, WidgetRef ref, Future<void> Function() action, String done) async {
    if (!ensureSignedIn(context, ref)) return;
    try {
      await action();
      ref.invalidate(communityProfileProvider(userId));
      if (context.mounted) showToast(context, done);
    } on ApiException catch (e) {
      if (context.mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.read(communityRepositoryProvider);
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: AsyncBody(
        value: ref.watch(communityProfileProvider(userId)),
        onRetry: () => ref.invalidate(communityProfileProvider(userId)),
        builder: (p) => PagedView<PostData>(
          key: ValueKey('${p.isBlocked}|${p.isFollowing}'),
          fetch: (page) =>
              p.isBlocked ? Future.value(const PageResult<PostData>([], 1, 1, 0)) : repo.userPosts(userId, page: page),
          itemBuilder: (_, post) => PostTile(post: post),
          empty: EmptyState(
            icon: p.isBlocked ? Icons.block : Icons.article_outlined,
            title: p.isBlocked ? 'You blocked this person' : 'No posts yet',
            message: p.isBlocked
                ? 'Unblock them to see their posts again.'
                : 'Posts appear here when they share something.',
          ),
          header: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 32,
                      child: Text(p.author.name[0].toUpperCase(), style: t.textTheme.headlineSmall),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.author.name, style: t.textTheme.headlineSmall),
                          if (p.author.city != null) Text(p.author.city!, style: t.textTheme.bodySmall),
                        ],
                      ),
                    ),
                    if (!p.isMe)
                      PopupMenuButton<String>(
                        tooltip: 'More',
                        onSelected: (v) => v == 'report'
                            ? showReportSheet(context, ref, 'user', userId)
                            : _run(
                                context,
                                ref,
                                () => repo.setBlock(userId, !p.isBlocked),
                                p.isBlocked ? 'Unblocked.' : 'Blocked.',
                              ),
                        itemBuilder: (_) => [
                          PopupMenuItem(value: 'block', child: Text(p.isBlocked ? 'Unblock' : 'Block')),
                          const PopupMenuItem(value: 'report', child: Text('Report profile')),
                        ],
                      ),
                  ],
                ),
                if (p.bio != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(p.bio!)),
                if (!p.isBlocked) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Text(
                        '${p.posts} posts · ${p.followers} followers · ${p.following} following',
                        style: t.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (!p.isMe && !p.isBlocked)
                      Expanded(
                        child: p.isFollowing
                            ? OutlinedButton(
                                onPressed: () => _run(context, ref, () => repo.setFollow(userId, false), 'Unfollowed.'),
                                child: const Text('Following'),
                              )
                            : FilledButton(
                                onPressed: () => _run(context, ref, () => repo.setFollow(userId, true), 'Following.'),
                                child: const Text('Follow'),
                              ),
                      ),
                    if (!p.isMe && !p.isBlocked) const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => context.push('/player/$userId'),
                        child: const Text('Tournament record'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
