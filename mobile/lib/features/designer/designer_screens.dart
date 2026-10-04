import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/kite_mark.dart';
import '../auth/application/auth_controller.dart';
import '../marketplace/data/marketplace_repository.dart';
import '../marketplace/data/models.dart' show AddressData, OptionData, formatPKR;
import '../marketplace/presentation/checkout_screen.dart' show AddressFormSheet;
import '../marketplace/presentation/product_screen.dart' show ensureSignedIn;
import '../marketplace/widgets/market_widgets.dart';
import '../tournaments/presentation/tournaments_tab.dart' show StatusPill, formatWhen;
import 'designer_repository.dart';
import 'kite_design.dart';
import '../../core/widgets/loaders.dart';
import '../../core/i18n/i18n.dart';

Color _statusColor(CustomOrderData r) => r.quoteExpired
    ? AppColors.muted
    : switch (r.status) {
        'ACCEPTED' => AppColors.success,
        'REJECTED' => AppColors.danger,
        'QUOTED' || 'CLARIFICATION_NEEDED' => AppColors.warning,
        'REQUESTED' => AppColors.info,
        _ => AppColors.muted,
      };

// ─── Designer ───────────────────────────────────────────────────────────────

class DesignerScreen extends ConsumerStatefulWidget {
  const DesignerScreen({super.key, this.designId});
  final String? designId;

  @override
  ConsumerState<DesignerScreen> createState() => _DesignerScreenState();
}

class _DesignerScreenState extends ConsumerState<DesignerScreen> {
  KiteDesign _d = const KiteDesign();
  final _name = TextEditingController();
  final _text = TextEditingController();
  String? _id;
  bool _loading = false;
  bool _saving = false;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _id = widget.designId;
    if (_id != null) _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _text.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final s = await ref.read(designerRepositoryProvider).design(_id!);
      _name.text = s.name;
      _text.text = s.design.text;
      setState(() => _d = s.design);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
      _id = null;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickImage() async {
    if (!ensureSignedIn(context, ref)) return;
    final f = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85, maxWidth: 1024);
    if (f == null) return;
    setState(() => _uploading = true);
    try {
      final u = await ref.read(designerRepositoryProvider).uploadImage(f.path, f.name);
      setState(() => _d = _d.withImage(u.id, u.url));
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save({required bool thenRequest}) async {
    if (!ensureSignedIn(context, ref)) return;
    if (_name.text.trim().length < 2) {
      showToast(context, 'Give your design a name (2–60 characters).'.tr, kind: ToastKind.error);
      return;
    }
    setState(() => _saving = true);
    try {
      final saved = await ref.read(designerRepositoryProvider).save(_id, _name.text.trim(), _d);
      _id = saved.id;
      ref.invalidate(myDesignsProvider);
      if (!mounted) return;
      showToast(context, 'Design saved.'.tr, kind: ToastKind.success);
      if (thenRequest) context.push('/custom-orders/new?design=${saved.id}');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.fieldErrors.values.firstOrNull ?? e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _section(String title, List<Widget> children) => Padding(
    padding: const EdgeInsets.only(top: 20),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...children,
      ],
    ),
  );

  Widget _choices(Map<String, String> options, String value, ValueChanged<String> onChanged) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: [
      for (final o in options.entries)
        ChoiceChip(label: Text(o.value.tr), selected: value == o.key, onSelected: (_) => onChanged(o.key)),
    ],
  );

  Widget _colors(String label, String value, ValueChanged<String> onChanged) => Padding(
    padding: const EdgeInsets.only(top: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final c in kiteSwatches)
              Semantics(
                button: true,
                selected: c == value.toUpperCase(),
                label: c,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () => onChanged(c),
                  child: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: hexColor(c),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: c == value.toUpperCase() ? Theme.of(context).colorScheme.primary : AppColors.neutral200,
                        width: c == value.toUpperCase() ? 3 : 1,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(authControllerProvider) is Authenticated;
    return Scaffold(
      appBar: AppBar(
        title: Text(_id == null ? 'Kite designer'.tr : 'Edit design'.tr),
        actions: [if (signedIn) TextButton(onPressed: () => context.push('/designs'), child: Text('My designs'.tr))],
      ),
      body: _loading
          ? Center(child: KiteLoader(label: 'Opening your design…'.tr))
          : Column(
              children: [
                Container(
                  width: double.infinity,
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      const Positioned.fill(child: KitePattern(cell: 40)),
                      KitePreview(design: _d, height: 230),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsetsDirectional.fromSTEB(16, 0, 16, 24),
                    children: [
                      _section('Shape'.tr, [
                        _choices(kiteShapes, _d.shape, (v) => setState(() => _d = _d.copyWith(shape: v))),
                      ]),
                      _section('Size'.tr, [
                        _choices(kiteSizes, _d.size, (v) => setState(() => _d = _d.copyWith(size: v))),
                      ]),
                      _section('Colours and pattern'.tr, [
                        _colors(
                          'Kite colour'.tr,
                          _d.background,
                          (c) => setState(() => _d = _d.copyWith(background: c)),
                        ),
                        const SizedBox(height: 12),
                        _choices(kitePatterns, _d.pattern, (v) => setState(() => _d = _d.copyWith(pattern: v))),
                        if (_d.pattern != 'none')
                          _colors(
                            'Pattern colour'.tr,
                            _d.patternColor,
                            (c) => setState(() => _d = _d.copyWith(patternColor: c)),
                          ),
                      ]),
                      _section('Text and logo'.tr, [
                        TextField(
                          controller: _text,
                          maxLength: 24,
                          decoration: InputDecoration(labelText: 'Text on the kite (optional)'.tr),
                          onChanged: (v) => setState(() => _d = _d.copyWith(text: v)),
                        ),
                        if (_d.text.trim().isNotEmpty) ...[
                          _choices(kiteFonts, _d.font, (v) => setState(() => _d = _d.copyWith(font: v))),
                          _colors(
                            'Text colour'.tr,
                            _d.textColor,
                            (c) => setState(() => _d = _d.copyWith(textColor: c)),
                          ),
                        ],
                        const SizedBox(height: 12),
                        if (_d.imageUrl != null)
                          OutlinedButton.icon(
                            onPressed: () => setState(() => _d = _d.withoutImage()),
                            icon: const Icon(Icons.close),
                            label: Text('Remove logo'.tr),
                          )
                        else
                          OutlinedButton.icon(
                            onPressed: _uploading ? null : _pickImage,
                            icon: _uploading
                                ? const KiteSpinner(size: 18)
                                : const Icon(Icons.add_photo_alternate_outlined),
                            label: Text(_uploading ? 'Uploading…'.tr : 'Add a logo'.tr),
                          ),
                      ]),
                      _section('Tail'.tr, [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('Add a tail'.tr),
                          value: _d.tail,
                          onChanged: (v) => setState(() => _d = _d.copyWith(tail: v)),
                        ),
                        if (_d.tail)
                          _colors(
                            'Tail colour'.tr,
                            _d.tailColor,
                            (c) => setState(() => _d = _d.copyWith(tailColor: c)),
                          ),
                      ]),
                      _section('Save'.tr, [
                        TextField(
                          controller: _name,
                          maxLength: 60,
                          decoration: InputDecoration(
                            labelText: 'Design name'.tr,
                            hintText: 'e.g. Team Falcon patang'.tr,
                          ),
                        ),
                        LoadingButton(
                          label: 'Save and request a quote'.tr,
                          loading: _saving,
                          onPressed: () => _save(thenRequest: true),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: _saving ? null : () => _save(thenRequest: false),
                          child: Text('Save design'.tr),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Preview only. The shop confirms materials, exact colours and size in its quote.'.tr,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ]),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

// ─── My designs ─────────────────────────────────────────────────────────────

class MyDesignsScreen extends ConsumerWidget {
  const MyDesignsScreen({super.key});

  Future<void> _delete(BuildContext context, WidgetRef ref, SavedDesign d) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Delete “{dName}”?'.trf({'dName': d.name})),
        content: Text('Requests already sent keep their copy.'.tr),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text('Keep'.tr)),
          TextButton(onPressed: () => Navigator.pop(c, true), child: Text('Delete'.tr)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(designerRepositoryProvider).delete(d.id);
      ref.invalidate(myDesignsProvider);
    } on ApiException catch (e) {
      if (context.mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: Text('My designs'.tr),
      actions: [TextButton(onPressed: () => context.push('/custom-orders'), child: Text('Requests'.tr))],
    ),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => context.push('/designer'),
      icon: const Icon(Icons.add),
      label: Text('New design'.tr),
    ),
    body: AsyncBody(
      value: ref.watch(myDesignsProvider),
      onRetry: () => ref.invalidate(myDesignsProvider),
      builder: (designs) => designs.isEmpty
          ? EmptyState(
              icon: Icons.palette_outlined,
              title: 'No designs yet'.tr,
              message: 'Create a kite in the designer and save it here.'.tr,
              action: FilledButton(onPressed: () => context.push('/designer'), child: Text('Open the designer'.tr)),
            )
          : RefreshIndicator(
              onRefresh: () => ref.refresh(myDesignsProvider.future),
              child: GridView.builder(
                padding: const EdgeInsetsDirectional.fromSTEB(16, 16, 16, 96),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 220,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.62,
                ),
                itemCount: designs.length,
                itemBuilder: (_, i) {
                  final d = designs[i];
                  return Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => context.push('/designer?id=${d.id}'),
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Center(child: KitePreview(design: d.design, height: 150)),
                            ),
                            Text(
                              d.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            Text(kiteShapes[d.design.shape]?.tr ?? '', style: Theme.of(context).textTheme.bodySmall),
                            Row(
                              children: [
                                Expanded(
                                  child: TextButton(
                                    onPressed: () => context.push('/custom-orders/new?design=${d.id}'),
                                    child: Text('Get quote'.tr),
                                  ),
                                ),
                                IconButton(
                                  tooltip: 'Delete'.tr,
                                  icon: const Icon(Icons.delete_outline),
                                  onPressed: () => _delete(context, ref, d),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    ),
  );
}

// ─── Request a quote ────────────────────────────────────────────────────────

final _requestSetupProvider = FutureProvider.autoDispose((ref) async {
  final repo = ref.watch(designerRepositoryProvider);
  final results = await Future.wait([repo.designs(), repo.shops()]);
  return (designs: results[0] as List<SavedDesign>, shops: results[1] as List<CustomShop>);
});

class RequestQuoteScreen extends ConsumerStatefulWidget {
  const RequestQuoteScreen({super.key, this.designId});
  final String? designId;

  @override
  ConsumerState<RequestQuoteScreen> createState() => _RequestQuoteScreenState();
}

class _RequestQuoteScreenState extends ConsumerState<RequestQuoteScreen> {
  final _form = GlobalKey<FormState>();
  final _qty = TextEditingController(text: '1');
  final _budget = TextEditingController();
  final _details = TextEditingController();
  String? _designId;
  String? _shopId;
  DateTime? _deadline;
  bool _busy = false;

  @override
  void dispose() {
    _qty.dispose();
    _budget.dispose();
    _details.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!_form.currentState!.validate() || _designId == null || _shopId == null) {
      if (_shopId == null) showToast(context, 'Choose a shop.'.tr, kind: ToastKind.error);
      return;
    }
    setState(() => _busy = true);
    try {
      final r = await ref.read(designerRepositoryProvider).create({
        'designId': _designId,
        'shopId': _shopId,
        'quantity': int.parse(_qty.text),
        'requirements': _details.text.trim(),
        if (_budget.text.trim().isNotEmpty) 'budget': int.parse(_budget.text.trim()),
        if (_deadline != null) 'deadline': _deadline!.toUtc().toIso8601String(),
      });
      if (!mounted) return;
      showToast(context, 'Request sent. The shop will reply with a quote or a question.'.tr, kind: ToastKind.success);
      context.pushReplacement('/custom-orders/${r.id}');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.fieldErrors.values.firstOrNull ?? e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Request a quote'.tr)),
    body: AsyncBody(
      value: ref.watch(_requestSetupProvider),
      onRetry: () => ref.invalidate(_requestSetupProvider),
      builder: (setup) {
        if (setup.designs.isEmpty) {
          return EmptyState(
            icon: Icons.palette_outlined,
            title: 'Save a design first'.tr,
            message: 'Create your kite in the designer, then come back here.'.tr,
            action: FilledButton(onPressed: () => context.push('/designer'), child: Text('Open the designer'.tr)),
          );
        }
        if (setup.shops.isEmpty) {
          return EmptyState(
            icon: Icons.storefront_outlined,
            title: 'No shops are taking custom orders'.tr,
            message: 'Please check again soon.'.tr,
          );
        }
        _designId ??= setup.designs.any((d) => d.id == widget.designId) ? widget.designId : setup.designs.first.id;
        final design = setup.designs.firstWhere((d) => d.id == _designId);
        return Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Center(child: KitePreview(design: design.design, height: 200)),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _designId,
                decoration: InputDecoration(labelText: 'Design'.tr),
                items: [for (final d in setup.designs) DropdownMenuItem(value: d.id, child: Text(d.name))],
                onChanged: (v) => setState(() => _designId = v),
              ),
              const SizedBox(height: 16),
              Text('Choose a shop'.tr, style: Theme.of(context).textTheme.titleMedium),
              RadioGroup<String>(
                groupValue: _shopId,
                onChanged: (v) => setState(() => _shopId = v),
                child: Column(
                  children: [
                    for (final s in setup.shops)
                      RadioListTile<String>(
                        contentPadding: EdgeInsets.zero,
                        value: s.id,
                        title: Row(
                          children: [
                            Flexible(child: Text(s.name)),
                            if (s.isVerified) ...[
                              const SizedBox(width: 4),
                              Icon(Icons.verified, size: 16, color: Theme.of(context).colorScheme.primary),
                            ],
                          ],
                        ),
                        subtitle: Text(s.city),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _qty,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: 'Quantity'.tr),
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  return n == null || n < 1 || n > 1000 ? 'Enter 1 to 1000'.tr : null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _budget,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: 'Budget for all, Rs (optional)'.tr),
                validator: (v) =>
                    v == null || v.trim().isEmpty || int.tryParse(v.trim()) != null ? null : 'Numbers only'.tr,
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.event_outlined),
                label: Text(
                  _deadline == null
                      ? 'Needed by (optional)'.tr
                      : 'Needed by {first}'.trf({'first': formatWhen(_deadline!).split(',').first}),
                ),
                onPressed: () async {
                  final now = DateTime.now();
                  final picked = await showDatePicker(
                    context: context,
                    firstDate: now.add(const Duration(days: 2)),
                    lastDate: now.add(const Duration(days: 365)),
                  );
                  if (picked != null) setState(() => _deadline = DateTime(picked.year, picked.month, picked.day, 12));
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _details,
                maxLines: 5,
                maxLength: 2000,
                decoration: InputDecoration(
                  labelText: 'Details for the shop'.tr,
                  hintText: 'Material, exact size, occasion, anything the shop should know.'.tr,
                  alignLabelWithHint: true,
                ),
                validator: (v) =>
                    (v ?? '').trim().length < 10 ? 'Describe what you need (at least 10 characters)'.tr : null,
              ),
              Text(
                'Shops make kites with paper and plain cotton string only. Requests for unsafe string or materials are refused.'
                    .tr,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              LoadingButton(label: 'Send request'.tr, loading: _busy, onPressed: _send),
            ],
          ),
        );
      },
    ),
  );
}

// ─── Requests list & detail ─────────────────────────────────────────────────

class CustomOrdersScreen extends ConsumerWidget {
  const CustomOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(designerRepositoryProvider);
    return Scaffold(
      appBar: AppBar(title: Text('Custom orders'.tr)),
      body: PagedView<CustomOrderData>(
        fetch: (page) => repo.requests(page: page),
        itemBuilder: (_, r) => Card(
          child: ListTile(
            contentPadding: const EdgeInsets.all(10),
            leading: SizedBox(width: 48, child: KitePreview(design: r.design, height: 62)),
            title: Text(r.designName),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('{shopName} · {quantity} pcs'.trf({'shopName': r.shopName, 'quantity': r.quantity})),
                const SizedBox(height: 4),
                StatusPill(r.statusLabel, _statusColor(r)),
              ],
            ),
            trailing: r.quotePrice == null
                ? null
                : Text(formatPKR(r.quotePrice!), style: const TextStyle(fontWeight: FontWeight.w600)),
            onTap: () => context.push('/custom-orders/${r.id}'),
          ),
        ),
        empty: EmptyState(
          icon: Icons.design_services_outlined,
          title: 'No requests yet'.tr,
          message: 'Design a kite, then ask a shop to make it.'.tr,
          action: FilledButton(onPressed: () => context.push('/designer'), child: Text('Open the designer'.tr)),
        ),
      ),
    );
  }
}

class CustomOrderScreen extends ConsumerStatefulWidget {
  const CustomOrderScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<CustomOrderScreen> createState() => _CustomOrderScreenState();
}

class _CustomOrderScreenState extends ConsumerState<CustomOrderScreen> {
  final _msg = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _msg.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      showToast(context, success, kind: ToastKind.success);
      ref.invalidate(customOrderProvider(widget.id));
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(String title) async =>
      await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: Text(title),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: Text('No'.tr)),
            TextButton(onPressed: () => Navigator.pop(c, true), child: Text('Yes'.tr)),
          ],
        ),
      ) ==
      true;

  Future<void> _accept(CustomOrderData r) async {
    final orderNumber = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _AcceptSheet(r: r),
    );
    if (orderNumber == null || !mounted) return;
    showToast(
      context,
      'Quote accepted. Order {orderNumber} is placed.'.trf({'orderNumber': orderNumber}),
      kind: ToastKind.success,
    );
    ref.invalidate(customOrderProvider(widget.id));
  }

  @override
  Widget build(BuildContext context) {
    final repo = ref.read(designerRepositoryProvider);
    return Scaffold(
      appBar: AppBar(title: Text('Custom order'.tr)),
      body: AsyncBody(
        value: ref.watch(customOrderProvider(widget.id)),
        onRetry: () => ref.invalidate(customOrderProvider(widget.id)),
        builder: (r) {
          final theme = Theme.of(context);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(customOrderProvider(widget.id).future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(width: 90, child: KitePreview(design: r.design, height: 117)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(r.designName, style: theme.textTheme.titleLarge),
                          Text(
                            '{shopName} · {quantity} pcs · {number}'.trf({
                              'shopName': r.shopName,
                              'quantity': r.quantity,
                              'number': r.number,
                            }),
                            style: theme.textTheme.bodySmall,
                          ),
                          const SizedBox(height: 6),
                          StatusPill(r.statusLabel, _statusColor(r)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (r.orderNumber != null)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.receipt_long_outlined),
                      title: Text('Order {orderNumber}'.trf({'orderNumber': r.orderNumber})),
                      subtitle: Text('Track it like any other order'.tr),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/orders/${r.orderNumber}'),
                    ),
                  ),
                if (r.quotePrice != null)
                  Card(
                    color: theme.colorScheme.primaryContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Quote'.tr, style: theme.textTheme.titleMedium),
                          Text(formatPKR(r.quotePrice!), style: theme.textTheme.headlineSmall),
                          Text(
                            'For {quantity} pcs, plus delivery · ready in {quoteDays} days'.trf({
                              'quantity': r.quantity,
                              'quoteDays': r.quoteDays,
                            }),
                          ),
                          if (r.quoteNote != null)
                            Padding(padding: const EdgeInsets.only(top: 6), child: Text(r.quoteNote!)),
                          const SizedBox(height: 6),
                          Text(
                            r.quoteExpired
                                ? 'This quote has expired.'.tr
                                : 'Valid until {quoteValidUntil}'.trf({
                                    'quoteValidUntil': formatWhen(r.quoteValidUntil!),
                                  }),
                            style: theme.textTheme.bodySmall,
                          ),
                          if (r.canAccept) ...[
                            const SizedBox(height: 10),
                            LoadingButton(
                              label: 'Accept and place order'.tr,
                              loading: _busy,
                              onPressed: () => _accept(r),
                            ),
                            TextButton(
                              onPressed: _busy
                                  ? null
                                  : () async {
                                      if (await _confirm('Decline this quote?'.tr)) {
                                        await _run(() => repo.command(r.id, 'decline'), 'Quote declined.'.tr);
                                      }
                                    },
                              child: Text('Decline quote'.tr),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                if (r.status == 'CLARIFICATION_NEEDED')
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text('The shop asked a question. Reply below so they can quote.'.tr),
                    ),
                  ),
                const SizedBox(height: 12),
                Text('Details'.tr, style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(r.requirements),
                if (r.budget != null)
                  Text('Budget: {budget}'.trf({'budget': formatPKR(r.budget!)}), style: theme.textTheme.bodySmall),
                const SizedBox(height: 16),
                Text('Conversation'.tr, style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                for (final m in r.messages)
                  m.role == 'system'
                      ? Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Text(m.body, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
                        )
                      : Align(
                          alignment: m.role == 'customer'
                              ? AlignmentDirectional.centerEnd
                              : AlignmentDirectional.centerStart,
                          child: Container(
                            constraints: const BoxConstraints(maxWidth: 300),
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: m.role == 'customer'
                                  ? theme.colorScheme.primary
                                  : theme.colorScheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${m.role == 'seller' ? r.shopName : 'You'.tr} · ${formatWhen(m.at)}',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: m.role == 'customer'
                                        ? theme.colorScheme.onPrimary.withValues(alpha: 0.8)
                                        : null,
                                  ),
                                ),
                                Text(
                                  m.body,
                                  style: TextStyle(color: m.role == 'customer' ? theme.colorScheme.onPrimary : null),
                                ),
                              ],
                            ),
                          ),
                        ),
                if (r.isOpen) ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _msg,
                    maxLines: 3,
                    minLines: 1,
                    maxLength: 2000,
                    decoration: InputDecoration(
                      hintText: 'Message the shop'.tr,
                      suffixIcon: IconButton(
                        tooltip: 'Send'.tr,
                        icon: const Icon(Icons.send),
                        onPressed: _busy
                            ? null
                            : () {
                                final text = _msg.text.trim();
                                if (text.isEmpty) return;
                                _run(() async {
                                  await repo.message(r.id, text);
                                  _msg.clear();
                                }, 'Message sent.'.tr);
                              },
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () async {
                            if (await _confirm('Cancel this request?'.tr)) {
                              await _run(() => repo.command(r.id, 'cancel'), 'Request cancelled.'.tr);
                            }
                          },
                    child: Text('Cancel request'.tr),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

final _acceptSetupProvider = FutureProvider.autoDispose((ref) async {
  final repo = ref.watch(marketplaceRepositoryProvider);
  final results = await Future.wait([repo.addresses(), repo.checkoutOptions()]);
  return (
    addresses: results[0] as List<AddressData>,
    options: results[1] as ({List<OptionData> delivery, List<OptionData> payment}),
  );
});

/// Address, delivery and payment for turning a quote into an order. Pops with the order number.
class _AcceptSheet extends ConsumerStatefulWidget {
  const _AcceptSheet({required this.r});
  final CustomOrderData r;

  @override
  ConsumerState<_AcceptSheet> createState() => _AcceptSheetState();
}

class _AcceptSheetState extends ConsumerState<_AcceptSheet> {
  String? _address;
  String? _delivery;
  String? _payment;
  List<AddressData>? _added;
  bool _busy = false;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsetsDirectional.fromSTEB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
    child: AsyncBody(
      value: ref.watch(_acceptSetupProvider),
      onRetry: () => ref.invalidate(_acceptSetupProvider),
      builder: (s) {
        final addresses = [...?_added, ...s.addresses];
        _address ??= addresses.where((a) => a.isDefault).firstOrNull?.id ?? addresses.firstOrNull?.id;
        _delivery ??= s.options.delivery.firstOrNull?.key;
        _payment ??= s.options.payment.firstOrNull?.key;
        final method = s.options.delivery.where((m) => m.key == _delivery).firstOrNull;
        final price = widget.r.quotePrice!;
        final fee = method == null ? 0 : (method.freeAbove != null && price >= method.freeAbove! ? 0 : method.fee ?? 0);
        return ListView(
          shrinkWrap: true,
          children: [
            Text('Accept and place the order'.tr, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Text('Deliver to'.tr, style: Theme.of(context).textTheme.titleSmall),
            RadioGroup<String>(
              groupValue: _address,
              onChanged: (v) => setState(() => _address = v),
              child: Column(
                children: [
                  for (final a in addresses)
                    RadioListTile<String>(
                      contentPadding: EdgeInsets.zero,
                      value: a.id,
                      title: Text('${a.fullName} · ${a.phone}'),
                      subtitle: Text('${a.line1}, ${a.city}'),
                    ),
                ],
              ),
            ),
            TextButton.icon(
              icon: const Icon(Icons.add),
              label: Text('Add an address'.tr),
              onPressed: () async {
                final a = await showModalBottomSheet<AddressData>(
                  context: context,
                  isScrollControlled: true,
                  showDragHandle: true,
                  builder: (_) => const AddressFormSheet(),
                );
                if (a != null) {
                  setState(() {
                    _added = [a, ...?_added];
                    _address = a.id;
                  });
                }
              },
            ),
            Text('Delivery'.tr, style: Theme.of(context).textTheme.titleSmall),
            RadioGroup<String>(
              groupValue: _delivery,
              onChanged: (v) => setState(() => _delivery = v),
              child: Column(
                children: [
                  for (final m in s.options.delivery)
                    RadioListTile<String>(
                      contentPadding: EdgeInsets.zero,
                      value: m.key,
                      title: Text('${m.label} · ${(m.fee ?? 0) == 0 ? 'Free' : formatPKR(m.fee!)}'),
                      subtitle: Text(m.description),
                    ),
                ],
              ),
            ),
            Text('Payment'.tr, style: Theme.of(context).textTheme.titleSmall),
            RadioGroup<String>(
              groupValue: _payment,
              onChanged: (v) => setState(() => _payment = v),
              child: Column(
                children: [
                  for (final p in s.options.payment)
                    RadioListTile<String>(
                      contentPadding: EdgeInsets.zero,
                      value: p.key,
                      title: Text(p.label),
                      subtitle: Text(p.description),
                    ),
                ],
              ),
            ),
            const Divider(),
            Text(
              'Quote {price} + delivery {fee}'.trf({
                'price': formatPKR(price),
                'fee': fee == 0 ? 'free' : formatPKR(fee),
              }),
            ),
            Text('Total {fee}'.trf({'fee': formatPKR(price + fee)}), style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            LoadingButton(
              label: 'Accept quote and place order'.tr,
              loading: _busy,
              onPressed: _address == null || _delivery == null || _payment == null
                  ? null
                  : () async {
                      setState(() => _busy = true);
                      try {
                        final number = await ref
                            .read(designerRepositoryProvider)
                            .accept(widget.r.id, addressId: _address!, delivery: _delivery!, payment: _payment!);
                        if (context.mounted) Navigator.pop(context, number);
                      } on ApiException catch (e) {
                        if (context.mounted) showToast(context, e.message, kind: ToastKind.error);
                      } finally {
                        if (mounted) setState(() => _busy = false);
                      }
                    },
            ),
          ],
        );
      },
    ),
  );
}
