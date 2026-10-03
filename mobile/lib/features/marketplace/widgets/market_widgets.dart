import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/kite_mark.dart';
import '../data/models.dart';

/// Product photo, or the kite placeholder when the seller has not uploaded one.
class ProductThumb extends StatelessWidget {
  const ProductThumb({super.key, required this.image, this.size, this.radius = AppRadius.md});

  final ImageRef? image;
  final double? size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primaryContainer,
            Theme.of(context).colorScheme.surfaceContainerHighest,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: KiteMark(size: (size ?? 120) * 0.32),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: image == null
          ? placeholder
          : Image.network(
              image!.url,
              width: size,
              height: size,
              fit: BoxFit.cover,
              semanticLabel: image!.alt,
              errorBuilder: (_, _, _) => placeholder,
            ),
    );
  }
}

class StarRating extends StatelessWidget {
  const StarRating({super.key, required this.value, this.count, this.size = 13});
  final double value;
  final int? count;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final full = value.round();
    return Semantics(
      label: count == 0 ? 'No reviews yet' : 'Rated ${value.toStringAsFixed(1)} out of 5',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 1; i <= 5; i++)
            Icon(Icons.star_rounded, size: size + 2, color: i <= full ? AppColors.maroon500 : t.colorScheme.outline),
          if (count != null) ...[
            const SizedBox(width: 4),
            Text(
              count! > 0 ? '${value.toStringAsFixed(1)} ($count)' : 'No reviews',
              style: t.textTheme.bodySmall?.copyWith(fontSize: size - 1),
            ),
          ],
        ],
      ),
    );
  }
}

class PriceText extends StatelessWidget {
  const PriceText({super.key, required this.price, this.compareAtPrice, this.from = false, this.large = false});
  final int price;
  final int? compareAtPrice;
  final bool from;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final discounted = compareAtPrice != null && compareAtPrice! > price;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.end,
      spacing: 6,
      children: [
        Text(
          '${from ? 'From ' : ''}${formatPKR(price)}',
          style: (large ? t.textTheme.headlineMedium : t.textTheme.titleMedium)?.copyWith(
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        if (discounted)
          Text(
            formatPKR(compareAtPrice!),
            style: t.textTheme.bodySmall?.copyWith(decoration: TextDecoration.lineThrough),
          ),
      ],
    );
  }
}

class ProductTile extends StatelessWidget {
  const ProductTile({super.key, required this.product});
  final ProductCardData product;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/product/${product.slug}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ProductThumb(image: product.image, radius: 0),
                  if (!product.inStock)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: t.colorScheme.onSurface.withValues(alpha: 0.8),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Out of stock',
                          style: t.textTheme.labelSmall?.copyWith(color: t.colorScheme.surface, letterSpacing: 0),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.shop.name,
                    style: t.textTheme.bodySmall?.copyWith(fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    product.title,
                    style: t.textTheme.titleMedium?.copyWith(fontSize: 14, height: 1.25),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  StarRating(value: product.ratingAvg, count: product.ratingCount, size: 11),
                  const SizedBox(height: 4),
                  PriceText(price: product.price, compareAtPrice: product.compareAtPrice, from: product.hasVariants),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const productGridDelegate = SliverGridDelegateWithMaxCrossAxisExtent(
  maxCrossAxisExtent: 240,
  mainAxisSpacing: 12,
  crossAxisSpacing: 12,
  childAspectRatio: 0.6,
);

class ShopTile extends StatelessWidget {
  const ShopTile({super.key, required this.shop});
  final ShopCardData shop;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        onTap: () => context.push('/shop/${shop.slug}'),
        leading: ShopAvatar(name: shop.name),
        title: Row(
          children: [
            Flexible(
              child: Text(shop.name, overflow: TextOverflow.ellipsis, style: t.textTheme.titleMedium),
            ),
            if (shop.isVerified) ...[
              const SizedBox(width: 4),
              Icon(Icons.verified, size: 16, color: AppColors.info, semanticLabel: 'Verified shop'),
            ],
          ],
        ),
        subtitle: Text('${shop.city} · ${shop.followerCount} followers', style: t.textTheme.bodySmall),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

class ShopAvatar extends StatelessWidget {
  const ShopAvatar({super.key, required this.name, this.size = 44});
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.primary,
      borderRadius: BorderRadius.circular(AppRadius.md),
    ),
    child: Text(
      name.isEmpty ? '?' : name[0].toUpperCase(),
      style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Theme.of(context).colorScheme.onPrimary),
    ),
  );
}

/// Loading / error / data for a [FutureProvider], with a retry button on errors.
class AsyncBody<T> extends ConsumerWidget {
  const AsyncBody({super.key, required this.value, required this.builder, required this.onRetry});
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) => value.when(
    data: builder,
    loading: () => const Center(child: CircularProgressIndicator()),
    error: (e, _) => ErrorRetry(message: e is ApiException ? e.message : 'Something went wrong.', onRetry: onRetry),
  );
}

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => EmptyState(
    icon: Icons.cloud_off_outlined,
    title: 'Could not load this',
    message: message,
    action: OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
  );
}

/// Infinite-scrolling list or grid with pull-to-refresh, loading, error and empty states.
/// Give it a new [Key] when its filters change to start again from page 1.
class PagedView<T> extends StatefulWidget {
  const PagedView({
    super.key,
    required this.fetch,
    required this.itemBuilder,
    required this.empty,
    this.grid = false,
    this.header,
    this.padding = const EdgeInsets.all(16),
  });

  final Future<PageResult<T>> Function(int page) fetch;
  final Widget Function(BuildContext context, T item) itemBuilder;
  final Widget empty;
  final bool grid;
  final Widget? header;
  final EdgeInsets padding;

  @override
  State<PagedView<T>> createState() => PagedViewState<T>();
}

class PagedViewState<T> extends State<PagedView<T>> {
  final _items = <T>[];
  int _page = 0;
  bool _hasMore = true;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadMore();
  }

  Future<void> refresh() async {
    setState(() {
      _items.clear();
      _page = 0;
      _hasMore = true;
      _error = null;
    });
    await _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    try {
      final res = await widget.fetch(_page + 1);
      if (!mounted) return;
      setState(() {
        _items.addAll(res.items);
        _page = res.page;
        _hasMore = res.hasMore;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final slivers = <Widget>[
      if (widget.header != null) SliverToBoxAdapter(child: widget.header),
      if (_items.isEmpty && _error != null)
        SliverFillRemaining(
          hasScrollBody: false,
          child: ErrorRetry(message: _error!, onRetry: refresh),
        )
      else if (_items.isEmpty && !_loading && !_hasMore)
        SliverFillRemaining(hasScrollBody: false, child: widget.empty)
      else if (widget.grid)
        SliverPadding(
          padding: widget.padding,
          sliver: SliverGrid.builder(
            gridDelegate: productGridDelegate,
            itemCount: _items.length,
            itemBuilder: (c, i) => widget.itemBuilder(c, _items[i]),
          ),
        )
      else
        SliverPadding(
          padding: widget.padding,
          sliver: SliverList.separated(
            itemCount: _items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (c, i) => widget.itemBuilder(c, _items[i]),
          ),
        ),
      if (_loading)
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
        ),
      if (_error != null && _items.isNotEmpty)
        SliverToBoxAdapter(
          child: Center(
            child: TextButton(onPressed: _loadMore, child: const Text('Could not load more. Try again')),
          ),
        ),
    ];

    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n.metrics.extentAfter < 400) _loadMore();
        return false;
      },
      child: RefreshIndicator(
        onRefresh: refresh,
        child: CustomScrollView(physics: const AlwaysScrollableScrollPhysics(), slivers: slivers),
      ),
    );
  }
}
