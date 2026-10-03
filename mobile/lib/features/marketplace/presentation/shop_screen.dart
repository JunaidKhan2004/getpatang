import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/kite_mark.dart';
import '../data/marketplace_repository.dart';
import '../data/models.dart';
import '../widgets/market_widgets.dart';
import 'product_screen.dart' show ensureSignedIn;

class ShopScreen extends ConsumerWidget {
  const ShopScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(),
    body: AsyncBody(
      value: ref.watch(shopProvider(slug)),
      onRetry: () => ref.invalidate(shopProvider(slug)),
      builder: (shop) => PagedView<ProductCardData>(
        grid: true,
        header: _ShopHeader(shop: shop),
        fetch: (page) => ref
            .read(marketplaceRepositoryProvider)
            .products(
              ProductFilters(shop: slug, sort: 'popular'),
              page: page,
            ),
        itemBuilder: (_, p) => ProductTile(product: p),
        empty: const EmptyState(
          icon: Icons.storefront_outlined,
          title: 'No products yet',
          message: 'This shop has not listed any products yet.',
        ),
      ),
    ),
  );
}

class _ShopHeader extends ConsumerStatefulWidget {
  const _ShopHeader({required this.shop});
  final ShopDetailData shop;

  @override
  ConsumerState<_ShopHeader> createState() => _ShopHeaderState();
}

class _ShopHeaderState extends ConsumerState<_ShopHeader> {
  late bool _following = widget.shop.isFollowing;
  late int _followers = widget.shop.followerCount;
  bool _busy = false;

  Future<void> _toggle() async {
    if (!ensureSignedIn(context, ref)) return;
    setState(() => _busy = true);
    try {
      final count = await ref.read(marketplaceRepositoryProvider).setFollow(widget.shop.slug, !_following);
      setState(() {
        _following = !_following;
        _followers = count;
      });
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final s = widget.shop;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(height: 110, color: AppColors.maroon900, child: const KitePattern(cell: 40)),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ShopAvatar(name: s.name, size: 56),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(child: Text(s.name, style: t.textTheme.headlineSmall)),
                            if (s.isVerified) ...[
                              const SizedBox(width: 6),
                              const Icon(
                                Icons.verified,
                                size: 20,
                                color: AppColors.info,
                                semanticLabel: 'Verified shop',
                              ),
                            ],
                          ],
                        ),
                        Text(
                          '${s.city} · $_followers followers · ${s.productCount ?? 0} products',
                          style: t.textTheme.bodySmall,
                        ),
                        StarRating(value: s.ratingAvg, count: s.ratingCount),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _following
                  ? OutlinedButton(onPressed: _busy ? null : _toggle, child: const Text('Following'))
                  : LoadingButton(label: 'Follow shop', loading: _busy, onPressed: _toggle),
              if (s.description != null) ...[
                const SizedBox(height: 14),
                Text(s.description!, style: t.textTheme.bodyMedium),
              ],
              if (s.phone != null || s.email != null) ...[
                const SizedBox(height: 8),
                if (s.phone != null) SelectableText('Phone: ${s.phone}', style: t.textTheme.bodySmall),
                if (s.email != null) SelectableText('Email: ${s.email}', style: t.textTheme.bodySmall),
              ],
              const SizedBox(height: 18),
              Text('Products', style: t.textTheme.titleLarge),
            ],
          ),
        ),
      ],
    );
  }
}

class ShopsScreen extends ConsumerWidget {
  const ShopsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('Shops')),
    body: PagedView<ShopCardData>(
      fetch: (page) => ref.read(marketplaceRepositoryProvider).shops(page: page),
      itemBuilder: (_, s) => ShopTile(shop: s),
      empty: const EmptyState(
        icon: Icons.storefront_outlined,
        title: 'No shops yet',
        message: 'Shops will appear here as they join.',
      ),
    ),
  );
}
