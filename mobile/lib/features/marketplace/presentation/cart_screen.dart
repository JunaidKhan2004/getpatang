import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/feedback.dart';
import '../application/cart_count.dart';
import '../data/marketplace_repository.dart';
import '../data/models.dart';
import '../widgets/market_widgets.dart';
import 'product_screen.dart' show QuantityStepper;

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = Theme.of(context);
    final cart = ref.watch(cartProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Your cart')),
      body: AsyncBody(
        value: cart,
        onRetry: () => ref.invalidate(cartProvider),
        builder: (c) => c.shops.isEmpty && c.savedForLater.isEmpty
            ? EmptyState(
                icon: Icons.shopping_bag_outlined,
                title: 'Your cart is empty',
                message: 'Find kites and accessories from verified shops.',
                action: FilledButton(
                  onPressed: () => context.go('/marketplace'),
                  child: const Text('Browse the marketplace'),
                ),
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(cartProvider.future),
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (c.shops.length > 1)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          'Your items come from ${c.shops.length} shops, so they arrive as ${c.shops.length} separate orders.',
                          style: t.textTheme.bodySmall,
                        ),
                      ),
                    for (final g in c.shops) ...[
                      Text(g.shop.name, style: t.textTheme.titleMedium),
                      const SizedBox(height: 6),
                      for (final line in g.items) _CartLineTile(line: line),
                      const SizedBox(height: 12),
                    ],
                    if (c.savedForLater.isNotEmpty) ...[
                      const Divider(height: 32),
                      Text('Saved for later (${c.savedForLater.length})', style: t.textTheme.titleMedium),
                      const SizedBox(height: 6),
                      for (final line in c.savedForLater) _CartLineTile(line: line),
                    ],
                  ],
                ),
              ),
      ),
      bottomNavigationBar: cart.value == null || cart.value!.shops.isEmpty
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                decoration: BoxDecoration(
                  color: t.colorScheme.surface,
                  border: Border(top: BorderSide(color: t.colorScheme.outline)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Text('Subtotal (${cart.value!.itemCount} items)', style: t.textTheme.bodyMedium),
                        const Spacer(),
                        Text(formatPKR(cart.value!.subtotal), style: t.textTheme.titleLarge),
                      ],
                    ),
                    if (!cart.value!.canCheckout)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Fix the items marked in red to continue.',
                          style: t.textTheme.bodySmall?.copyWith(color: AppColors.danger),
                        ),
                      ),
                    const SizedBox(height: 10),
                    FilledButton(
                      onPressed: cart.value!.canCheckout ? () => context.push('/checkout') : null,
                      child: const Text('Proceed to checkout'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _CartLineTile extends ConsumerStatefulWidget {
  const _CartLineTile({required this.line});
  final CartLineData line;

  @override
  ConsumerState<_CartLineTile> createState() => _CartLineTileState();
}

class _CartLineTileState extends ConsumerState<_CartLineTile> {
  bool _busy = false;

  Future<void> _run(Future<void> Function(MarketplaceRepository repo) action, {String? done}) async {
    setState(() => _busy = true);
    try {
      await action(ref.read(marketplaceRepositoryProvider));
      refreshCart(ref);
      if (mounted && done != null) showToast(context, done);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final l = widget.line;
    return Opacity(
      opacity: _busy ? 0.5 : 1,
      child: Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: () => context.push('/product/${l.slug}'),
                child: ProductThumb(image: l.image, size: 72),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l.title,
                      style: t.textTheme.titleMedium?.copyWith(fontSize: 14),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (l.variantName != null) Text(l.variantName!, style: t.textTheme.bodySmall),
                    Text(formatPKR(l.lineTotal), style: t.textTheme.titleMedium),
                    if (l.issue != null)
                      Text(
                        l.issue!,
                        style: t.textTheme.bodySmall?.copyWith(color: AppColors.danger, fontWeight: FontWeight.w600),
                      ),
                    const SizedBox(height: 6),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 4,
                      children: [
                        if (!l.savedForLater && l.available > 0)
                          QuantityStepper(
                            value: l.quantity,
                            max: (l.available > l.quantity ? l.available : l.quantity).clamp(1, 99),
                            enabled: !_busy,
                            onChanged: (q) => _run((r) => r.updateCartItem(l.id, quantity: q)),
                          ),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => _run((r) => r.updateCartItem(l.id, savedForLater: !l.savedForLater)),
                          child: Text(l.savedForLater ? 'Move to cart' : 'Save for later'),
                        ),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => _run((r) => r.removeCartItem(l.id), done: 'Removed from your cart.'),
                          child: const Text('Remove'),
                        ),
                      ],
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
}
