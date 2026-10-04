import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/kite_mark.dart';
import '../data/models.dart';
import '../../../core/widgets/loaders.dart';
import '../../../core/i18n/i18n.dart';

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
      label: count == 0
          ? 'No reviews yet'.tr
          : 'Rated {toStringAsFixed} out of 5'.trf({'toStringAsFixed': value.toStringAsFixed(1)}),
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 1; i <= 5; i++)
            Icon(Icons.star_rounded, size: size + 2, color: i <= full ? AppColors.maroon500 : t.colorScheme.outline),
          if (count != null) ...[
            const SizedBox(width: 4),
            Text(
              count! > 0 ? '${value.toStringAsFixed(1)} ($count)' : 'No reviews'.tr,
              style: t.textTheme.bodySmall?.copyWith(fontSize: size - 1),
            ),
          ],
        ],
      ),
    );
  }
}

class PriceText extends StatelessWidget {
  const PriceText({
    super.key,
    required this.price,
    this.compareAtPrice,
    this.from = false,
    this.large = false,
    this.oneLine = false,
  });
  final int price;
  final int? compareAtPrice;
  final bool from;
  final bool large;

  /// Keeps price and old price on one line (product cards have a fixed height).
  final bool oneLine;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final discounted = compareAtPrice != null && compareAtPrice! > price;
    final current = Text(
      '${from ? 'From ' : ''}${formatPKR(price)}',
      maxLines: oneLine ? 1 : null,
      overflow: oneLine ? TextOverflow.ellipsis : null,
      style: (large ? t.textTheme.headlineMedium : t.textTheme.titleMedium)?.copyWith(
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
    final old = discounted
        ? Text(
            formatPKR(compareAtPrice!),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: t.textTheme.bodySmall?.copyWith(decoration: TextDecoration.lineThrough),
          )
        : null;
    if (oneLine) {
      // The current price always shows in full; the old price uses whatever room is left.
      return LayoutBuilder(
        builder: (context, box) => Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: box.maxWidth),
              child: current,
            ),
            if (old != null) ...[const SizedBox(width: 6), Expanded(child: old)],
          ],
        ),
      );
    }
    return Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 6, children: [current, ?old]);
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
                          'Out of stock'.tr,
                          style: t.textTheme.labelSmall?.copyWith(color: t.colorScheme.surface, letterSpacing: 0),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(10, 8, 10, 10),
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
                    Flexible(
                      child: Text(
                        product.title,
                        style: t.textTheme.titleMedium?.copyWith(fontSize: 14, height: 1.25),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(height: 4),
                    StarRating(value: product.ratingAvg, count: product.ratingCount, size: 11),
                    const SizedBox(height: 4),
                    PriceText(
                      price: product.price,
                      compareAtPrice: product.compareAtPrice,
                      from: product.hasVariants,
                      oneLine: true,
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

/// Product grid sized for its content: a square photo plus room for the text below it,
/// which grows with the phone's font size so cards never overflow.
SliverGridDelegate productGridDelegate(BuildContext context) =>
    _ProductGridDelegate(MediaQuery.textScalerOf(context).scale(1));

class _ProductGridDelegate extends SliverGridDelegate {
  const _ProductGridDelegate(this.textScale);
  final double textScale;

  static const _maxTileWidth = 240.0;
  static const _spacing = 12.0;

  /// Shop name, two-line title, stars and one-line price, with padding (at 100% font size).
  static const _textBlock = 124.0;

  @override
  SliverGridLayout getLayout(SliverConstraints constraints) {
    final cross = constraints.crossAxisExtent;
    final count = math.max(1, ((cross + _spacing) / (_maxTileWidth + _spacing)).ceil());
    final width = (cross - _spacing * (count - 1)) / count;
    final height = width + _textBlock * math.max(1.0, textScale);
    return SliverGridRegularTileLayout(
      crossAxisCount: count,
      mainAxisStride: height + _spacing,
      crossAxisStride: width + _spacing,
      childMainAxisExtent: height,
      childCrossAxisExtent: width,
      reverseCrossAxis: axisDirectionIsReversed(constraints.crossAxisDirection),
    );
  }

  @override
  bool shouldRelayout(_ProductGridDelegate oldDelegate) => oldDelegate.textScale != textScale;
}

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
              Icon(Icons.verified, size: 16, color: AppColors.info, semanticLabel: 'Verified shop'.tr),
            ],
          ],
        ),
        subtitle: Text(
          '{city} · {followerCount} followers'.trf({'city': shop.city, 'followerCount': shop.followerCount}),
          style: t.textTheme.bodySmall,
        ),
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
    loading: () => const Center(child: KiteLoader()),
    error: (e, _) => ErrorRetry(message: e is ApiException ? e.message : 'Something went wrong.'.tr, onRetry: onRetry),
  );
}

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => EmptyState(
    icon: Icons.cloud_off_outlined,
    title: 'Could not load this'.tr,
    message: message,
    action: OutlinedButton(onPressed: onRetry, child: Text('Try again'.tr)),
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
            gridDelegate: productGridDelegate(context),
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
      // First page: skeletons shaped like the real content. Later pages: a small kite at the bottom.
      if (_loading && _items.isEmpty)
        SliverPadding(
          padding: widget.padding,
          sliver: widget.grid ? ProductGridSkeleton(gridDelegate: productGridDelegate(context)) : const ListSkeleton(),
        )
      else if (_loading)
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(20),
            child: Center(child: KiteSpinner(size: 26)),
          ),
        ),
      if (_error != null && _items.isNotEmpty)
        SliverToBoxAdapter(
          child: Center(
            child: TextButton(onPressed: _loadMore, child: Text('Could not load more. Try again'.tr)),
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
