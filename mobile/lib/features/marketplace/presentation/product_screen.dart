import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/feedback.dart';
import '../../auth/application/auth_controller.dart';
import '../../shell/main_shell.dart';
import '../application/cart_count.dart';
import '../data/marketplace_repository.dart';
import '../data/models.dart';
import '../widgets/market_widgets.dart';
import '../../../core/widgets/loaders.dart';

/// Sends a guest to sign in and returns false; true when signed in.
bool ensureSignedIn(BuildContext context, WidgetRef ref) {
  if (ref.read(authControllerProvider) is Authenticated) return true;
  showToast(context, 'Please sign in to continue.');
  context.push(Uri(path: '/login', queryParameters: {'from': GoRouterState.of(context).uri.toString()}).toString());
  return false;
}

class ProductScreen extends ConsumerWidget {
  const ProductScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(actions: const [GlobalActions()]),
      body: AsyncBody(
        value: ref.watch(productProvider(slug)),
        onRetry: () => ref.invalidate(productProvider(slug)),
        builder: (p) => _ProductBody(product: p),
      ),
    );
  }
}

class _ProductBody extends ConsumerStatefulWidget {
  const _ProductBody({required this.product});
  final ProductDetailData product;

  @override
  ConsumerState<_ProductBody> createState() => _ProductBodyState();
}

class _ProductBodyState extends ConsumerState<_ProductBody> {
  late String? _variantId = widget.product.variants.where((v) => v.stock > 0).firstOrNull?.id;
  late bool _wishlisted = widget.product.isWishlisted;
  int _quantity = 1;
  bool _adding = false;

  ProductDetailData get p => widget.product;
  VariantData? get _variant => p.variants.where((v) => v.id == _variantId).firstOrNull;
  int get _available => p.variants.isEmpty ? p.stock : (_variant?.stock ?? 0);
  int get _price => _variant?.price ?? p.price;

  Future<void> _add({bool goToCart = false}) async {
    if (!ensureSignedIn(context, ref)) return;
    setState(() => _adding = true);
    try {
      await ref.read(marketplaceRepositoryProvider).addToCart(p.id, variantId: _variantId, quantity: _quantity);
      refreshCart(ref);
      if (!mounted) return;
      if (goToCart) {
        context.push('/cart');
      } else {
        showToast(context, 'Added to your cart.', kind: ToastKind.success);
      }
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  Future<void> _toggleWishlist() async {
    if (!ensureSignedIn(context, ref)) return;
    final next = !_wishlisted;
    setState(() => _wishlisted = next);
    try {
      await ref.read(marketplaceRepositoryProvider).setWishlist(p.id, next);
      if (mounted) showToast(context, next ? 'Saved to your wishlist.' : 'Removed from your wishlist.');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _wishlisted = !next);
      showToast(context, e.message, kind: ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final reviews = ref.watch(productReviewsProvider(p.slug));
    final available = _available;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              SizedBox(
                height: 320,
                child: p.images.isEmpty
                    ? const ProductThumb(image: null, radius: 0, size: double.infinity)
                    : PageView(children: [for (final img in p.images) ProductThumb(image: img, radius: 0)]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: Text(p.title, style: t.textTheme.headlineSmall)),
                        IconButton(
                          tooltip: _wishlisted ? 'Remove from wishlist' : 'Save to wishlist',
                          onPressed: _toggleWishlist,
                          icon: Icon(
                            _wishlisted ? Icons.favorite : Icons.favorite_border,
                            color: t.colorScheme.primary,
                          ),
                        ),
                      ],
                    ),
                    StarRating(value: p.ratingAvg, count: p.ratingCount),
                    const SizedBox(height: 12),
                    PriceText(
                      price: _price * _quantity,
                      compareAtPrice: p.variants.isEmpty ? p.compareAtPrice : null,
                      large: true,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      available <= 0
                          ? 'Out of stock'
                          : available <= 5
                          ? 'Only $available left'
                          : 'In stock',
                      style: t.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: available <= 0
                            ? AppColors.danger
                            : available <= 5
                            ? AppColors.warning
                            : AppColors.success,
                      ),
                    ),
                    if (p.variants.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text('Choose an option', style: t.textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final v in p.variants)
                            ChoiceChip(
                              label: Text(v.stock > 0 ? v.name : '${v.name} · sold out'),
                              selected: v.id == _variantId,
                              onSelected: v.stock > 0
                                  ? (_) => setState(() {
                                      _variantId = v.id;
                                      _quantity = 1;
                                    })
                                  : null,
                            ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Text('Quantity', style: t.textTheme.titleMedium),
                        const Spacer(),
                        QuantityStepper(
                          value: _quantity,
                          max: available.clamp(1, 99),
                          enabled: available > 0,
                          onChanged: (q) => setState(() => _quantity = q),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: ListTile(
                        onTap: () => context.push('/shop/${p.shop.slug}'),
                        leading: ShopAvatar(name: p.shop.name, size: 40),
                        title: Text('Sold by ${p.shop.name}'),
                        subtitle: Text(p.shop.city),
                        trailing: const Icon(Icons.chevron_right),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text('Description', style: t.textTheme.titleLarge),
                    const SizedBox(height: 6),
                    Text(p.description, style: t.textTheme.bodyLarge),
                    if (p.specifications.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Text('Specifications', style: t.textTheme.titleLarge),
                      const SizedBox(height: 6),
                      for (final (label, value) in p.specifications)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(child: Text(label, style: t.textTheme.bodySmall)),
                              Expanded(
                                child: Text(
                                  value,
                                  style: t.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Icon(Icons.local_shipping_outlined, size: 18, color: t.colorScheme.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            p.shippingInfo ?? 'Delivery across Pakistan. Shipping fee shown at checkout.',
                            style: t.textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Text('Reviews', style: t.textTheme.titleLarge),
                    const SizedBox(height: 6),
                    reviews.when(
                      loading: () => const ListRowSkeleton(kite: false),
                      error: (_, _) => Text('Reviews could not load.', style: t.textTheme.bodySmall),
                      data: (r) => r.items.isEmpty
                          ? Text(
                              'No reviews yet. Customers can review after their order is delivered.',
                              style: t.textTheme.bodySmall,
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                for (final rv in r.items)
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        StarRating(value: rv.rating.toDouble()),
                                        if (rv.comment != null) Text(rv.comment!),
                                        Text(rv.authorName, style: t.textTheme.bodySmall),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                    ),
                    if (p.related.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Text('You may also like', style: t.textTheme.titleLarge),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 300,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: p.related.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 12),
                          itemBuilder: (_, i) => SizedBox(width: 170, child: ProductTile(product: p.related[i])),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            decoration: BoxDecoration(
              color: t.colorScheme.surface,
              border: Border(top: BorderSide(color: t.colorScheme.outline)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: available > 0 && !_adding ? () => _add(goToCart: true) : null,
                    child: const Text('Buy now'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: LoadingButton(label: 'Add to cart', loading: _adding, onPressed: available > 0 ? _add : null),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.value,
    required this.max,
    required this.onChanged,
    this.enabled = true,
  });
  final int value;
  final int max;
  final ValueChanged<int> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      border: Border.all(color: Theme.of(context).colorScheme.outline),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: 'Decrease quantity',
          visualDensity: VisualDensity.compact,
          onPressed: enabled && value > 1 ? () => onChanged(value - 1) : null,
          icon: const Icon(Icons.remove),
        ),
        SizedBox(
          width: 28,
          child: Text('$value', textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
        ),
        IconButton(
          tooltip: 'Increase quantity',
          visualDensity: VisualDensity.compact,
          onPressed: enabled && value < max ? () => onChanged(value + 1) : null,
          icon: const Icon(Icons.add),
        ),
      ],
    ),
  );
}
