import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/feedback.dart';
import '../data/marketplace_repository.dart';
import '../data/models.dart';
import '../widgets/market_widgets.dart';

String _date(DateTime d) {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final l = d.toLocal();
  return '${l.day} ${m[l.month - 1]} ${l.year}';
}

Color _statusColor(String s) => switch (s) {
  'DELIVERED' => AppColors.success,
  'CANCELLED' => AppColors.danger,
  'PENDING' => AppColors.warning,
  'REFUNDED' || 'RETURNED' => AppColors.muted,
  _ => AppColors.info,
};

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) {
    final c = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
      child: Text(
        orderStatusLabels[status] ?? status,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(color: c, letterSpacing: 0),
      ),
    );
  }
}

/// Shown right after checkout. Receives the checkout result via go_router `extra`.
class OrderPlacedScreen extends StatelessWidget {
  const OrderPlacedScreen({super.key, required this.result});
  final ({String checkoutId, String? instructions, int total, List<String> orderNumbers})? result;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final r = result;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Icon(Icons.check_circle, size: 72, color: AppColors.success),
              const SizedBox(height: 16),
              Text('Your order is placed', textAlign: TextAlign.center, style: t.textTheme.headlineMedium),
              const SizedBox(height: 8),
              if (r != null) ...[
                Text(
                  r.orderNumbers.length > 1
                      ? 'Your items come from ${r.orderNumbers.length} shops, so you have ${r.orderNumbers.length} orders: ${r.orderNumbers.join(', ')}.'
                      : 'Order ${r.orderNumbers.first}. The shop will confirm it soon.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text('Total ${formatPKR(r.total)}', textAlign: TextAlign.center, style: t.textTheme.titleLarge),
                if (r.instructions != null) ...[
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(padding: const EdgeInsets.all(14), child: Text(r.instructions!)),
                  ),
                ],
              ],
              const Spacer(),
              FilledButton(onPressed: () => context.go('/orders'), child: const Text('View my orders')),
              const SizedBox(height: 8),
              OutlinedButton(onPressed: () => context.go('/marketplace'), child: const Text('Continue shopping')),
            ],
          ),
        ),
      ),
    );
  }
}

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: PagedView<OrderSummaryData>(
        fetch: (page) => ref.read(marketplaceRepositoryProvider).orders(page: page),
        empty: EmptyState(
          icon: Icons.receipt_long_outlined,
          title: 'No orders yet',
          message: 'When you place an order it will appear here.',
          action: FilledButton(onPressed: () => context.go('/marketplace'), child: const Text('Start shopping')),
        ),
        itemBuilder: (_, o) => Card(
          child: InkWell(
            onTap: () => context.push('/orders/${o.orderNumber}'),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(o.orderNumber, style: t.textTheme.titleMedium)),
                      StatusChip(o.status),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('${o.shopName} · ${_date(o.createdAt)}', style: t.textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Text(o.itemsText, maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Text(formatPKR(o.total), style: t.textTheme.titleMedium),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class OrderScreen extends ConsumerWidget {
  const OrderScreen({super.key, required this.orderNumber});
  final String orderNumber;

  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Cancel this order?'),
        content: TextField(
          controller: reason,
          maxLength: 300,
          decoration: const InputDecoration(labelText: 'Reason (optional)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Keep order')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Cancel order')),
        ],
      ),
    );
    final text = reason.text.trim();
    reason.dispose();
    if (ok != true) return;
    try {
      await ref.read(marketplaceRepositoryProvider).cancelOrder(orderNumber, text.isEmpty ? null : text);
      ref.invalidate(orderProvider(orderNumber));
      if (context.mounted) showToast(context, 'Your order was cancelled.', kind: ToastKind.success);
    } on ApiException catch (e) {
      if (context.mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  Future<void> _review(BuildContext context, WidgetRef ref, String slug) async {
    var rating = 0;
    final comment = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: const Text('Write a review'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 1; i <= 5; i++)
                    IconButton(
                      tooltip: '$i star${i > 1 ? 's' : ''}',
                      onPressed: () => set(() => rating = i),
                      icon: Icon(
                        Icons.star_rounded,
                        size: 32,
                        color: i <= rating ? AppColors.maroon500 : Theme.of(c).colorScheme.outline,
                      ),
                    ),
                ],
              ),
              TextField(
                controller: comment,
                maxLength: 1000,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Your review (optional)'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
            TextButton(onPressed: rating == 0 ? null : () => Navigator.pop(c, true), child: const Text('Publish')),
          ],
        ),
      ),
    );
    final text = comment.text.trim();
    comment.dispose();
    if (ok != true) return;
    try {
      await ref.read(marketplaceRepositoryProvider).review(slug, rating, text.isEmpty ? null : text);
      ref.invalidate(orderProvider(orderNumber));
      if (context.mounted) showToast(context, 'Thanks! Your review is published.', kind: ToastKind.success);
    } on ApiException catch (e) {
      if (context.mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(orderNumber)),
      body: AsyncBody(
        value: ref.watch(orderProvider(orderNumber)),
        onRetry: () => ref.invalidate(orderProvider(orderNumber)),
        builder: (o) {
          final stopped = const ['CANCELLED', 'REFUNDED', 'RETURNED'].contains(o.status);
          final reached = o.progress.indexOf(o.status);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(orderProvider(orderNumber).future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    Expanded(child: Text('Placed ${_date(o.createdAt)} · ${o.shopName}', style: t.textTheme.bodySmall)),
                    StatusChip(o.status),
                  ],
                ),
                if (o.paymentInstructions != null && o.paymentStatus == 'PENDING' && !stopped) ...[
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(padding: const EdgeInsets.all(14), child: Text(o.paymentInstructions!)),
                  ),
                ],
                if (o.paymentReviewNote != null && o.paymentStatus == 'PENDING' && !stopped)
                  Card(
                    color: AppColors.danger.withValues(alpha: 0.08),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Text('We could not verify your payment: ${o.paymentReviewNote}'),
                    ),
                  ),
                if (o.canSubmitProof) _PaymentProofCard(order: o),
                for (final r in o.refunds)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.currency_exchange),
                      title: Text(
                        r.status == 'COMPLETED'
                            ? 'Refund of ${formatPKR(r.amount)} sent'
                            : 'Refund of ${formatPKR(r.amount)} in progress',
                      ),
                      subtitle: r.reference == null ? null : Text('Reference ${r.reference}'),
                    ),
                  ),
                const SizedBox(height: 16),
                Text('Order progress', style: t.textTheme.titleLarge),
                const SizedBox(height: 8),
                if (stopped)
                  for (final e in o.timeline)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.circle, size: 12, color: _statusColor(e.status)),
                      title: Text(orderStatusLabels[e.status] ?? e.status),
                      subtitle: Text([e.note, _date(e.at)].whereType<String>().join('\n')),
                    )
                else
                  for (final (i, s) in o.progress.indexed)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(
                        i <= reached ? Icons.check_circle : Icons.radio_button_unchecked,
                        color: i <= reached ? t.colorScheme.primary : t.colorScheme.outline,
                      ),
                      title: Text(
                        orderStatusLabels[s]!,
                        style: TextStyle(fontWeight: i == reached ? FontWeight.w700 : FontWeight.w400),
                      ),
                    ),
                const SizedBox(height: 16),
                Text('Items', style: t.textTheme.titleLarge),
                for (final i in o.items)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(i.title),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${i.variantName != null ? '${i.variantName} · ' : ''}Qty ${i.quantity}'),
                        if (i.canReview && i.productSlug != null)
                          TextButton(
                            style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                            onPressed: () => _review(context, ref, i.productSlug!),
                            child: const Text('Write a review'),
                          ),
                      ],
                    ),
                    trailing: Text(formatPKR(i.lineTotal)),
                    onTap: i.productSlug == null ? null : () => context.push('/product/${i.productSlug}'),
                  ),
                const Divider(),
                _line(t, 'Items', formatPKR(o.subtotal)),
                _line(t, 'Shipping', o.shippingFee == 0 ? 'Free' : formatPKR(o.shippingFee)),
                if (o.discount > 0) _line(t, 'Discount', '−${formatPKR(o.discount)}'),
                _line(t, 'Total', formatPKR(o.total), bold: true),
                const SizedBox(height: 16),
                Text('Delivery', style: t.textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(o.address),
                if (o.paymentLabel != null) ...[
                  const SizedBox(height: 16),
                  Text('Payment', style: t.textTheme.titleLarge),
                  Text('${o.paymentLabel} · ${paymentStatusLabels[o.paymentStatus] ?? o.paymentStatus?.toLowerCase()}'),
                ],
                const SizedBox(height: 16),
                Text('Need help with this order?', style: t.textTheme.titleLarge),
                Text('Contact ${o.shopName} directly:', style: t.textTheme.bodySmall),
                if (o.shopPhone != null) SelectableText(o.shopPhone!),
                if (o.shopEmail != null) SelectableText(o.shopEmail!),
                if (o.canCancel) ...[
                  const SizedBox(height: 24),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
                    onPressed: () => _cancel(context, ref),
                    child: const Text('Cancel order'),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _line(ThemeData t, String label, String value, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Text(label, style: bold ? t.textTheme.titleLarge : t.textTheme.bodyMedium),
        const Spacer(),
        Text(value, style: bold ? t.textTheme.titleLarge : t.textTheme.bodyMedium),
      ],
    ),
  );
}

class WishlistScreen extends ConsumerWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('Wishlist')),
    body: PagedView<ProductCardData>(
      grid: true,
      fetch: (page) => ref.read(marketplaceRepositoryProvider).wishlist(page: page),
      itemBuilder: (_, p) => ProductTile(product: p),
      empty: const EmptyState(
        icon: Icons.favorite_border,
        title: 'Nothing saved yet',
        message: 'Tap the heart on any product to keep it here.',
      ),
    ),
  );
}

/// Bank transfer: send the transaction reference and an optional receipt photo.
class _PaymentProofCard extends ConsumerStatefulWidget {
  const _PaymentProofCard({required this.order});
  final OrderDetailData order;

  @override
  ConsumerState<_PaymentProofCard> createState() => _PaymentProofCardState();
}

class _PaymentProofCardState extends ConsumerState<_PaymentProofCard> {
  final _reference = TextEditingController();
  XFile? _receipt;
  bool _busy = false;
  late bool _editing = widget.order.paymentStatus != 'VERIFYING';

  @override
  void dispose() {
    _reference.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final ref_ = _reference.text.trim();
    if (ref_.length < 4) {
      showToast(context, 'Enter the transaction reference from your bank.', kind: ToastKind.error);
      return;
    }
    setState(() => _busy = true);
    final repo = ref.read(marketplaceRepositoryProvider);
    try {
      final uploadId = _receipt == null ? null : await repo.uploadPaymentProof(_receipt!.path, _receipt!.name);
      final msg = await repo.submitPaymentProof(widget.order.orderNumber, ref_, proofUploadId: uploadId);
      if (!mounted) return;
      showToast(context, msg, kind: ToastKind.success);
      ref.invalidate(orderProvider(widget.order.orderNumber));
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.fieldErrors['reference'] ?? e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final o = widget.order;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              o.paymentStatus == 'VERIFYING' ? 'We are checking your transfer' : 'Paid by bank transfer? Tell us',
              style: t.textTheme.titleMedium,
            ),
            if (o.paymentStatus == 'VERIFYING')
              Text(
                'Reference ${o.paymentReference}. The shop starts preparing once it is verified.',
                style: t.textTheme.bodySmall,
              ),
            if (!_editing)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => setState(() => _editing = true),
                  child: const Text('Update transfer details'),
                ),
              )
            else ...[
              const SizedBox(height: 8),
              TextField(
                controller: _reference,
                maxLength: 64,
                decoration: const InputDecoration(
                  labelText: 'Transaction reference',
                  helperText: 'From your bank app or receipt.',
                ),
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.receipt_long_outlined),
                label: Text(
                  _receipt == null ? 'Add receipt photo (optional)' : _receipt!.name,
                  overflow: TextOverflow.ellipsis,
                ),
                onPressed: () async {
                  final f = await ImagePicker().pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 85,
                    maxWidth: 2048,
                  );
                  if (f != null) setState(() => _receipt = f);
                },
              ),
              const SizedBox(height: 8),
              LoadingButton(label: 'I have paid', loading: _busy, onPressed: _send),
            ],
          ],
        ),
      ),
    );
  }
}
