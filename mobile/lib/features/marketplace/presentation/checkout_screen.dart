import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/feedback.dart';
import '../../auth/presentation/complete_profile_screen.dart' show pakistanCities;
import '../application/cart_count.dart';
import '../data/marketplace_repository.dart';
import '../data/models.dart';
import '../../../core/widgets/loaders.dart';
import '../../../core/i18n/i18n.dart';

/// Random UUID v4 so a retried "Place order" never creates duplicate orders.
String _uuid() {
  final r = Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

final _checkoutDataProvider = FutureProvider.autoDispose((ref) async {
  final repo = ref.watch(marketplaceRepositoryProvider);
  final results = await Future.wait([repo.addresses(), repo.checkoutOptions()]);
  final options = results[1] as ({List<OptionData> delivery, List<OptionData> payment});
  return (addresses: results[0] as List<AddressData>, delivery: options.delivery, payment: options.payment);
});

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _checkoutId = _uuid();
  final _coupon = TextEditingController();
  final _notes = TextEditingController();
  List<AddressData>? _addresses;
  String? _addressId;
  String? _delivery;
  String? _payment;
  String? _appliedCoupon;
  String? _couponError;
  QuoteData? _quote;
  String? _quoteError;
  bool _pricing = false;
  bool _placing = false;

  @override
  void dispose() {
    _coupon.dispose();
    _notes.dispose();
    super.dispose();
  }

  /// Prices the order on the server. An invalid coupon is dropped and the order re-priced without it.
  Future<void> _price() async {
    if (_delivery == null) return;
    setState(() => _pricing = true);
    try {
      final q = await ref.read(marketplaceRepositoryProvider).quote(_delivery!, _appliedCoupon);
      if (!mounted) return;
      setState(() {
        _quote = q;
        _quoteError = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'COUPON_INVALID' && _appliedCoupon != null) {
        setState(() {
          _couponError = e.message;
          _appliedCoupon = null;
        });
        await _price();
        return;
      }
      setState(() => _quoteError = e.message);
    } finally {
      if (mounted) setState(() => _pricing = false);
    }
  }

  Future<void> _addAddress() async {
    final created = await showModalBottomSheet<AddressData>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const AddressFormSheet(),
    );
    if (created != null) {
      setState(() {
        _addresses = [created, ..._addresses!];
        _addressId = created.id;
      });
    }
  }

  Future<void> _place() async {
    if (_addressId == null) {
      showToast(context, 'Please add a delivery address.'.tr, kind: ToastKind.error);
      return;
    }
    setState(() => _placing = true);
    try {
      final res = await ref
          .read(marketplaceRepositoryProvider)
          .placeOrder(
            checkoutId: _checkoutId,
            addressId: _addressId!,
            deliveryMethod: _delivery!,
            paymentMethod: _payment!,
            couponCode: _appliedCoupon,
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          );
      refreshCart(ref);
      if (mounted) context.go('/order-placed', extra: res);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final data = ref.watch(_checkoutDataProvider);

    return Scaffold(
      appBar: AppBar(title: Text('Checkout'.tr)),
      body: data.when(
        loading: () => Center(child: KiteLoader(label: 'Preparing checkout…'.tr)),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off_outlined,
          title: 'Checkout could not load'.tr,
          message: e is ApiException ? e.message : 'Please try again.'.tr,
          action: OutlinedButton(onPressed: () => ref.invalidate(_checkoutDataProvider), child: Text('Try again'.tr)),
        ),
        data: (d) {
          if (_addresses == null) {
            // First load: pick defaults, then price the order.
            _addresses = d.addresses;
            _addressId = d.addresses.where((a) => a.isDefault).firstOrNull?.id ?? d.addresses.firstOrNull?.id;
            _delivery = d.delivery.firstOrNull?.key;
            _payment = d.payment.firstOrNull?.key;
            WidgetsBinding.instance.addPostFrameCallback((_) => _price());
          }
          if (d.payment.isEmpty) {
            return EmptyState(
              icon: Icons.payments_outlined,
              title: 'Ordering is paused'.tr,
              message: 'Payment methods are being set up. Please try again later.'.tr,
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(child: Text('1. Delivery address'.tr, style: t.textTheme.titleLarge)),
                  TextButton.icon(onPressed: _addAddress, icon: const Icon(Icons.add), label: Text('New'.tr)),
                ],
              ),
              if (_addresses!.isEmpty)
                OutlinedButton.icon(
                  onPressed: _addAddress,
                  icon: const Icon(Icons.add_location_alt_outlined),
                  label: Text('Add a delivery address'.tr),
                ),
              RadioGroup<String>(
                groupValue: _addressId,
                onChanged: (v) => setState(() => _addressId = v),
                child: Column(
                  children: [
                    for (final a in _addresses!)
                      Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: RadioListTile<String>(
                          value: a.id,
                          title: Text(a.label == null ? a.fullName : '${a.fullName} · ${a.label}'),
                          subtitle: Text('${a.oneLine}\n${a.phone}'),
                          isThreeLine: true,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text('2. Delivery method'.tr, style: t.textTheme.titleLarge),
              RadioGroup<String>(
                groupValue: _delivery,
                onChanged: (v) {
                  setState(() => _delivery = v);
                  _price();
                },
                child: Column(
                  children: [
                    for (final m in d.delivery)
                      Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: RadioListTile<String>(
                          value: m.key,
                          title: Text(m.label),
                          subtitle: Text(
                            '{description}\n{fee} per shop{freeAbove}'.trf({
                              'description': m.description,
                              'fee': formatPKR(m.fee!),
                              'freeAbove': m.freeAbove != null ? ' · free above ${formatPKR(m.freeAbove!)}' : '',
                            }),
                          ),
                          isThreeLine: true,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text('3. Payment'.tr, style: t.textTheme.titleLarge),
              RadioGroup<String>(
                groupValue: _payment,
                onChanged: (v) => setState(() => _payment = v),
                child: Column(
                  children: [
                    for (final m in d.payment)
                      Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: RadioListTile<String>(value: m.key, title: Text(m.label), subtitle: Text(m.description)),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _notes,
                maxLength: 300,
                maxLines: 2,
                decoration: InputDecoration(labelText: 'Note for the shop (optional)'.tr),
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _coupon,
                      textCapitalization: TextCapitalization.characters,
                      decoration: InputDecoration(labelText: 'Coupon code'.tr, errorText: _couponError),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(minimumSize: const Size(80, 52)),
                      onPressed: _pricing
                          ? null
                          : () {
                              setState(() {
                                _couponError = null;
                                _appliedCoupon = _coupon.text.trim().isEmpty ? null : _coupon.text.trim().toUpperCase();
                              });
                              _price();
                            },
                      child: Text('Apply'.tr),
                    ),
                  ),
                ],
              ),
              if (_quote?.couponCode != null)
                Text(
                  'Coupon {couponCode} applied.'.trf({'couponCode': _quote!.couponCode}),
                  style: t.textTheme.bodySmall?.copyWith(color: AppColors.success),
                ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: _quote == null
                      ? Center(
                          child: _quoteError != null
                              ? Text(_quoteError!, style: const TextStyle(color: AppColors.danger))
                              : const KiteSpinner(size: 24),
                        )
                      : Column(
                          children: [
                            _row(context, 'Items'.tr, formatPKR(_quote!.subtotal)),
                            _row(
                              context,
                              _quote!.shopCount > 1
                                  ? 'Shipping ({shopCount} shops)'.trf({'shopCount': _quote!.shopCount})
                                  : 'Shipping'.tr,
                              _quote!.shippingFee == 0 ? 'Free'.tr : formatPKR(_quote!.shippingFee),
                            ),
                            if (_quote!.discount > 0)
                              _row(context, 'Discount'.tr, '−${formatPKR(_quote!.discount)}', color: AppColors.success),
                            const Divider(height: 20),
                            _row(context, 'Total'.tr, formatPKR(_quote!.total), bold: true),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 8),
              Text('You can cancel until the shop starts preparing your order.'.tr, style: t.textTheme.bodySmall),
            ],
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 16, 12),
          child: LoadingButton(
            label: _quote == null ? 'Place order'.tr : 'Place order · {total}'.trf({'total': formatPKR(_quote!.total)}),
            loading: _placing,
            onPressed: _quote == null || _pricing || _addressId == null ? null : _place,
          ),
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value, {bool bold = false, Color? color}) {
    final style = bold
        ? Theme.of(context).textTheme.titleLarge
        : Theme.of(context).textTheme.bodyMedium?.copyWith(color: color);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Text(label, style: style),
          const Spacer(),
          Text(value, style: style),
        ],
      ),
    );
  }
}

class AddressFormSheet extends ConsumerStatefulWidget {
  const AddressFormSheet({super.key});

  @override
  ConsumerState<AddressFormSheet> createState() => _AddressFormSheetState();
}

class _AddressFormSheetState extends ConsumerState<AddressFormSheet> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _line1 = TextEditingController();
  final _line2 = TextEditingController();
  String? _city;
  bool _default = false;
  bool _saving = false;

  @override
  void dispose() {
    for (final c in [_name, _phone, _line1, _line2]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final a = await ref.read(marketplaceRepositoryProvider).createAddress({
        'fullName': _name.text.trim(),
        'phone': _phone.text.replaceAll(RegExp(r'[\s-]'), ''),
        'line1': _line1.text.trim(),
        if (_line2.text.trim().isNotEmpty) 'line2': _line2.text.trim(),
        'city': _city,
        'isDefault': _default,
      });
      if (mounted) Navigator.pop(context, a);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsetsDirectional.fromSTEB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
    child: Form(
      key: _form,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('New delivery address'.tr, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              validator: (v) => Validators.name(v, 'Full name'.tr),
              decoration: InputDecoration(labelText: 'Full name'.tr),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              validator: (v) => Validators.required(v, 'Mobile number'.tr) ?? Validators.optionalPhone(v),
              decoration: InputDecoration(labelText: 'Mobile number'.tr, hintText: '03XX XXXXXXX'.tr),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _line1,
              validator: (v) => (v == null || v.trim().length < 5) ? 'Enter the street address'.tr : null,
              decoration: InputDecoration(labelText: 'Street address'.tr),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _line2,
              decoration: InputDecoration(labelText: 'Area / landmark (optional)'.tr),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _city,
              items: [for (final c in pakistanCities) DropdownMenuItem(value: c, child: Text(c.tr))],
              onChanged: (v) => setState(() => _city = v),
              validator: (v) => v == null ? 'Choose a city'.tr : null,
              decoration: InputDecoration(labelText: 'City'.tr),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _default,
              onChanged: (v) => setState(() => _default = v ?? false),
              title: Text('Make this my default address'.tr),
            ),
            LoadingButton(label: 'Save address'.tr, loading: _saving, onPressed: _save),
          ],
        ),
      ),
    ),
  );
}
