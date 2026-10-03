import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';

import '../../../core/config/env.dart';
import '../../../core/network/api_client.dart';
import '../../../core/widgets/feedback.dart';
import '../../marketplace/presentation/product_screen.dart' show ensureSignedIn;
import '../../marketplace/widgets/market_widgets.dart' show ProductThumb;
import '../../marketplace/data/models.dart' show ImageRef;
import '../data/community_repository.dart';

/// Asks for a reason and sends a report about a post, comment or user.
Future<void> showReportSheet(BuildContext context, WidgetRef ref, String targetType, String targetId) async {
  if (!ensureSignedIn(context, ref)) return;
  String? reason;
  final details = TextEditingController();
  final ok = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (c) => StatefulBuilder(
      builder: (c, set) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(c).bottom + 20),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Why are you reporting this?', style: Theme.of(c).textTheme.titleLarge),
              RadioGroup<String>(
                groupValue: reason,
                onChanged: (v) => set(() => reason = v),
                child: Column(
                  children: [
                    for (final e in reportReasons.entries)
                      RadioListTile<String>(contentPadding: EdgeInsets.zero, value: e.key, title: Text(e.value)),
                  ],
                ),
              ),
              TextField(
                controller: details,
                maxLength: 1000,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Anything else? (optional)'),
              ),
              FilledButton(
                onPressed: reason == null ? null : () => Navigator.pop(c, true),
                child: const Text('Send report'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
  final text = details.text.trim();
  details.dispose();
  if (ok != true || reason == null) return;
  try {
    await ref.read(communityRepositoryProvider).report(targetType, targetId, reason!, text.isEmpty ? null : text);
    if (context.mounted) {
      showToast(context, 'Thanks for reporting. Our moderators will review it.', kind: ToastKind.success);
    }
  } on ApiException catch (e) {
    if (context.mounted) showToast(context, e.message, kind: ToastKind.error);
  }
}

class _VideoBox extends StatefulWidget {
  const _VideoBox({required this.url});
  final String url;

  @override
  State<_VideoBox> createState() => _VideoBoxState();
}

class _VideoBoxState extends State<_VideoBox> {
  late final VideoPlayerController _c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
  bool _ready = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _c.initialize().then(
      (_) => mounted ? setState(() => _ready = true) : null,
      onError: (_) => mounted ? setState(() => _failed = true) : null,
    );
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return Container(
        height: 180,
        color: Colors.black,
        alignment: Alignment.center,
        child: const Text('Video could not load', style: TextStyle(color: Colors.white)),
      );
    }
    if (!_ready) {
      return Container(
        height: 220,
        color: Colors.black,
        alignment: Alignment.center,
        child: const CircularProgressIndicator(),
      );
    }
    return AspectRatio(
      aspectRatio: _c.value.aspectRatio,
      child: Stack(
        alignment: Alignment.center,
        children: [
          VideoPlayer(_c),
          Semantics(
            button: true,
            label: _c.value.isPlaying ? 'Pause video' : 'Play video',
            child: GestureDetector(
              onTap: () => setState(() => _c.value.isPlaying ? _c.pause() : _c.play()),
              child: AnimatedOpacity(
                opacity: _c.value.isPlaying ? 0 : 1,
                duration: const Duration(milliseconds: 200),
                child: const CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.black54,
                  child: Icon(Icons.play_arrow, color: Colors.white, size: 36),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PostTile extends ConsumerStatefulWidget {
  const PostTile({super.key, required this.post, this.openOnTap = true, this.onDeleted});
  final PostData post;
  final bool openOnTap;
  final VoidCallback? onDeleted;

  @override
  ConsumerState<PostTile> createState() => _PostTileState();
}

class _PostTileState extends ConsumerState<PostTile> {
  late PostData _p = widget.post;
  bool _deleted = false;

  Future<void> _like() async {
    if (!ensureSignedIn(context, ref)) return;
    final next = !_p.likedByMe;
    setState(() => _p = _p.copyWith(likedByMe: next, likeCount: _p.likeCount + (next ? 1 : -1)));
    try {
      final r = await ref.read(communityRepositoryProvider).setLike(_p.id, next);
      if (mounted) setState(() => _p = _p.copyWith(likedByMe: r.liked, likeCount: r.likeCount));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _p = _p.copyWith(likedByMe: !next, likeCount: _p.likeCount + (next ? -1 : 1)));
      showToast(context, e.message, kind: ToastKind.error);
    }
  }

  Future<void> _share() async {
    try {
      final r = await ref.read(communityRepositoryProvider).share(_p.id);
      if (mounted) setState(() => _p = _p.copyWith(shareCount: r.shareCount));
      await SharePlus.instance.share(
        ShareParams(text: 'Post by ${_p.author.name} on GetPatang: ${Env.webBaseUrl}${r.path}'),
      );
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  Future<void> _edit() async {
    final ctrl = TextEditingController(text: _p.body);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Edit post'),
        content: TextField(controller: ctrl, maxLines: 5, maxLength: 2000),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Save')),
        ],
      ),
    );
    final text = ctrl.text.trim();
    ctrl.dispose();
    if (ok != true || text.isEmpty) return;
    try {
      await ref.read(communityRepositoryProvider).editPost(_p.id, text);
      if (mounted) setState(() => _p = _p.copyWith(body: text, edited: true));
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Delete this post?'),
        content: const Text('It will be removed for everyone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(communityRepositoryProvider).deletePost(_p.id);
      if (!mounted) return;
      setState(() => _deleted = true);
      widget.onDeleted?.call();
      showToast(context, 'Post deleted.');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_deleted) return const SizedBox.shrink();
    final t = Theme.of(context);
    final p = _p;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: widget.openOnTap ? () => context.push('/post/${p.id}') : null,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 4, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  GestureDetector(
                    onTap: () => context.push('/u/${p.author.id}'),
                    child: CircleAvatar(child: Text(p.author.name[0].toUpperCase())),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.author.name, style: t.textTheme.titleMedium?.copyWith(fontSize: 15)),
                        Text(
                          [p.author.city, timeAgo(p.createdAt), if (p.edited) 'edited'].whereType<String>().join(' · '),
                          style: t.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    tooltip: 'Post options',
                    onSelected: (v) => switch (v) {
                      'edit' => _edit(),
                      'delete' => _delete(),
                      _ => showReportSheet(context, ref, 'post', p.id),
                    },
                    itemBuilder: (_) => p.isMine
                        ? const [
                            PopupMenuItem(value: 'edit', child: Text('Edit post')),
                            PopupMenuItem(value: 'delete', child: Text('Delete post')),
                          ]
                        : const [PopupMenuItem(value: 'report', child: Text('Report post'))],
                  ),
                ],
              ),
              Padding(padding: const EdgeInsets.fromLTRB(0, 8, 10, 8), child: Text(p.body)),
              if (p.media.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 10, bottom: 6),
                  child: p.media.first.kind == 'video'
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: _VideoBox(url: p.media.first.url),
                        )
                      : GridView.count(
                          crossAxisCount: p.media.length == 1 ? 1 : 2,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          mainAxisSpacing: 4,
                          crossAxisSpacing: 4,
                          childAspectRatio: p.media.length == 1 ? 4 / 3 : 1,
                          children: [for (final m in p.media) ProductThumb(image: ImageRef(m.url, 'Photo'), radius: 8)],
                        ),
                ),
              Row(
                children: [
                  TextButton.icon(
                    onPressed: _like,
                    icon: Icon(p.likedByMe ? Icons.favorite : Icons.favorite_border, size: 20),
                    label: Text('${p.likeCount}'),
                  ),
                  TextButton.icon(
                    onPressed: () => context.push('/post/${p.id}'),
                    icon: const Icon(Icons.mode_comment_outlined, size: 20),
                    label: Text('${p.commentCount}'),
                  ),
                  TextButton.icon(
                    onPressed: _share,
                    icon: const Icon(Icons.share_outlined, size: 20),
                    label: Text(p.shareCount > 0 ? '${p.shareCount}' : 'Share'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
