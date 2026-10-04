import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/application/auth_controller.dart';
import '../../shell/main_shell.dart';
import '../data/marketplace_repository.dart';
import '../widgets/market_widgets.dart';
import 'home_hero.dart';
import '../../../core/widgets/loaders.dart';
import '../../../core/i18n/i18n.dart';

class HomeTab extends ConsumerStatefulWidget {
  const HomeTab({super.key});

  @override
  ConsumerState<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends ConsumerState<HomeTab> {
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final auth = ref.watch(authControllerProvider);
    final user = auth is Authenticated ? auth.user : null;
    final feed = ref.watch(homeFeedProvider);
    final categories = ref.watch(categoriesProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref
            ..invalidate(categoriesProvider)
            ..invalidate(homeFeedProvider);
          await ref.read(homeFeedProvider.future);
        },
        child: CustomScrollView(
          controller: _scroll,
          slivers: [
            SliverToBoxAdapter(
              child: HomeHero(
                scroll: _scroll,
                top: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (user?.profile?.city != null)
                            Row(
                              children: [
                                const Icon(Icons.location_on_outlined, size: 14, color: AppColors.maroon100),
                                const SizedBox(width: 2),
                                Text(
                                  user!.profile!.city!,
                                  style: t.textTheme.bodySmall?.copyWith(color: AppColors.maroon100),
                                ),
                              ],
                            ),
                          Text(
                            user == null
                                ? 'Welcome to GetPatang'.tr
                                : 'Assalam o Alaikum, {fullName}'.trf({
                                    'fullName': user.profile?.displayName ?? user.fullName,
                                  }),
                            style: t.textTheme.titleLarge?.copyWith(color: AppColors.white),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const IconTheme(
                      data: IconThemeData(color: AppColors.white),
                      child: GlobalActions(),
                    ),
                  ],
                ),
                search: Material(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    onTap: () => context.push('/search'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                      child: Row(
                        children: [
                          const Icon(Icons.search, color: AppColors.muted),
                          const SizedBox(width: 10),
                          Text(
                            'Search kites, shops…'.tr,
                            style: t.textTheme.bodyMedium?.copyWith(color: AppColors.muted),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: categories.maybeWhen(
                data: (cats) => SizedBox(
                  height: 56,
                  child: ListView.separated(
                    padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 4),
                    scrollDirection: Axis.horizontal,
                    itemCount: cats.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (_, i) => ActionChip(
                      label: Text(cats[i].name),
                      onPressed: () => context.go('/marketplace?category=${cats[i].slug}'),
                    ),
                  ),
                ),
                orElse: () => const SizedBox(height: 8),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 16, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: _QuickLink(
                        icon: Icons.celebration_outlined,
                        title: 'Events'.tr,
                        subtitle: 'Festivals & workshops'.tr,
                        onTap: () => context.push('/events'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _QuickLink(
                        icon: Icons.palette_outlined,
                        title: 'Design a kite'.tr,
                        subtitle: 'Get a shop quote'.tr,
                        onTap: () => context.push('/designer'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            ...feed.when(
              loading: () => [
                SliverPadding(
                  padding: const EdgeInsetsDirectional.fromSTEB(16, 24, 16, 16),
                  sliver: ProductGridSkeleton(gridDelegate: productGridDelegate(context), count: 4),
                ),
              ],
              error: (e, _) => [
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: ErrorRetry(message: '$e', onRetry: () => ref.invalidate(homeFeedProvider)),
                ),
              ],
              data: (d) => [
                if (d.products.isNotEmpty) ...[
                  _SectionHeader(
                    title: 'Popular right now'.tr,
                    onSeeAll: () => context.go('/marketplace?sort=popular'),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverGrid.builder(
                      gridDelegate: productGridDelegate(context),
                      itemCount: d.products.length,
                      itemBuilder: (_, i) => ProductTile(product: d.products[i]),
                    ),
                  ),
                ],
                if (d.shops.isNotEmpty) ...[
                  _SectionHeader(title: 'Popular shops'.tr, onSeeAll: () => context.push('/shops')),
                  SliverPadding(
                    padding: const EdgeInsetsDirectional.fromSTEB(16, 0, 16, 24),
                    sliver: SliverList.separated(
                      itemCount: d.shops.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => ShopTile(shop: d.shops[i]),
                    ),
                  ),
                ],
                if (d.products.isEmpty && d.shops.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Text('Shops will appear here as they join.'.tr),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.onSeeAll});
  final String title;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) => SliverPadding(
    padding: const EdgeInsetsDirectional.fromSTEB(16, 20, 8, 10),
    sliver: SliverToBoxAdapter(
      child: Row(
        children: [
          Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
          TextButton(onPressed: onSeeAll, child: Text('See all'.tr)),
        ],
      ),
    ),
  );
}

class _QuickLink extends StatelessWidget {
  const _QuickLink({required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleSmall),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
