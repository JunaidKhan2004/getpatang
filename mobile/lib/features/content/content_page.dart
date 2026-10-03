import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/loaders.dart';

/// Staff-written public pages (about, contact, faq, terms, privacy), from Admin → Content.
const contentPageTitles = {
  'about': 'About',
  'contact': 'Contact',
  'faq': 'FAQ',
  'terms': 'Terms of Service',
  'privacy': 'Privacy Policy',
};

/// Null when the page is not published yet.
final contentPageProvider = FutureProvider.autoDispose.family<({String title, String body})?, String>((
  ref,
  slug,
) async {
  try {
    final res = await ref.watch(apiClientProvider).request<Map<String, dynamic>>('GET', '/pages/$slug', auth: false);
    return (title: res['title'] as String, body: res['body'] as String);
  } on ApiException catch (e) {
    if (e.statusCode == 404) return null;
    rethrow;
  }
});

/// Same rules as web/src/components/content/page-body.tsx: blank line between paragraphs,
/// "## " heading, "- " list items. Plain text only.
List<Widget> renderPageBody(BuildContext context, String body) {
  final t = Theme.of(context).textTheme;
  final blocks = body.replaceAll('\r\n', '\n').split(RegExp(r'\n{2,}')).map((b) => b.trim()).where((b) => b.isNotEmpty);
  return [
    for (final b in blocks)
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: b.startsWith('## ')
            ? Text(b.substring(3), style: t.titleLarge)
            : b.split('\n').every((l) => l.startsWith('- '))
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final l in b.split('\n'))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('•  '),
                          Expanded(child: Text(l.substring(2), style: t.bodyLarge)),
                        ],
                      ),
                    ),
                ],
              )
            : Text(b, style: t.bodyLarge?.copyWith(height: 1.5)),
      ),
  ];
}

class ContentPageScreen extends ConsumerWidget {
  const ContentPageScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(contentPageProvider(slug));
    final fallback = contentPageTitles[slug] ?? 'Page';
    return Scaffold(
      appBar: AppBar(title: Text(page.value?.title ?? fallback)),
      body: page.when(
        loading: () => const SingleChildScrollView(padding: EdgeInsets.all(20), child: TextSkeleton()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$e', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => ref.invalidate(contentPageProvider(slug)),
                  child: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
        data: (p) => p == null
            ? EmptyState(
                icon: Icons.description_outlined,
                title: 'Coming soon',
                message: 'This page will be published before launch.',
              )
            : ListView(padding: const EdgeInsets.all(20), children: renderPageBody(context, p.body)),
      ),
    );
  }
}
