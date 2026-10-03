import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/feedback.dart';
import '../../auth/presentation/complete_profile_screen.dart' show pakistanCities;
import '../../shell/main_shell.dart';
import '../data/marketplace_repository.dart';
import '../data/models.dart';
import '../widgets/market_widgets.dart';

const _sorts = {
  'newest': 'Newest',
  'popular': 'Most popular',
  'rating': 'Top rated',
  'price_asc': 'Price: low to high',
  'price_desc': 'Price: high to low',
};

class MarketplaceTab extends ConsumerStatefulWidget {
  const MarketplaceTab({super.key, this.initialCategory, this.initialSort});
  final String? initialCategory;
  final String? initialSort;

  @override
  ConsumerState<MarketplaceTab> createState() => _MarketplaceTabState();
}

class _MarketplaceTabState extends ConsumerState<MarketplaceTab> {
  late ProductFilters _filters = ProductFilters(category: widget.initialCategory, sort: widget.initialSort ?? 'newest');
  final _search = TextEditingController();

  @override
  void didUpdateWidget(covariant MarketplaceTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Deep links (e.g. a category chip on Home) arrive as new query parameters.
    if (oldWidget.initialCategory != widget.initialCategory || oldWidget.initialSort != widget.initialSort) {
      setState(
        () => _filters = _filters.copyWith(
          category: () => widget.initialCategory,
          sort: widget.initialSort ?? _filters.sort,
        ),
      );
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _openFilters() async {
    final result = await showModalBottomSheet<ProductFilters>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _FilterSheet(initial: _filters),
    );
    if (result != null) setState(() => _filters = result);
  }

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(marketplaceRepositoryProvider);
    final categories = ref.watch(categoriesProvider).value ?? const <CategoryData>[];
    final flat = [
      for (final c in categories) ...[c, ...c.children],
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Marketplace'), actions: const [GlobalActions()]),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (v) =>
                        setState(() => _filters = _filters.copyWith(q: () => v.trim().isEmpty ? null : v.trim())),
                    decoration: InputDecoration(
                      hintText: 'Search the marketplace',
                      prefixIcon: const Icon(Icons.search),
                      isDense: true,
                      suffixIcon: _filters.q == null
                          ? null
                          : IconButton(
                              tooltip: 'Clear search',
                              icon: const Icon(Icons.close),
                              onPressed: () {
                                _search.clear();
                                setState(() => _filters = _filters.copyWith(q: () => null));
                              },
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Badge(
                  isLabelVisible: _filters.isFiltered,
                  smallSize: 9,
                  child: IconButton.outlined(
                    tooltip: 'Filter and sort',
                    onPressed: _openFilters,
                    icon: const Icon(Icons.tune),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                for (final c in [null, ...flat])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(c?.name ?? 'All'),
                      selected: _filters.category == c?.slug,
                      onSelected: (_) => setState(() => _filters = _filters.copyWith(category: () => c?.slug)),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: PagedView<ProductCardData>(
              key: ValueKey(_filters),
              grid: true,
              fetch: (page) => repo.products(_filters, page: page),
              itemBuilder: (_, p) => ProductTile(product: p),
              empty: const EmptyState(
                icon: Icons.search_off,
                title: 'No products found',
                message: 'Try another category or remove a filter.',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.initial});
  final ProductFilters initial;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late String _sort = widget.initial.sort;
  late String? _city = widget.initial.city;
  late int? _minRating = widget.initial.minRating;
  late bool _inStock = widget.initial.inStock;
  late final _min = TextEditingController(text: widget.initial.minPrice?.toString() ?? '');
  late final _max = TextEditingController(text: widget.initial.maxPrice?.toString() ?? '');

  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Sort and filter', style: t.textTheme.titleLarge),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _sort,
              decoration: const InputDecoration(labelText: 'Sort by'),
              items: [for (final e in _sorts.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
              onChanged: (v) => setState(() => _sort = v!),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _min,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(labelText: 'Min price (Rs)'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _max,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(labelText: 'Max price (Rs)'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String?>(
              initialValue: _city,
              decoration: const InputDecoration(labelText: 'Shop location'),
              items: [
                const DropdownMenuItem(value: null, child: Text('All cities')),
                for (final c in pakistanCities) DropdownMenuItem(value: c, child: Text(c)),
              ],
              onChanged: (v) => setState(() => _city = v),
            ),
            const SizedBox(height: 16),
            Text('Rating', style: t.textTheme.titleMedium),
            Wrap(
              spacing: 8,
              children: [
                for (final r in [null, 4, 3])
                  ChoiceChip(
                    label: Text(r == null ? 'Any' : '$r★ & up'),
                    selected: _minRating == r,
                    onSelected: (_) => setState(() => _minRating = r),
                  ),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('In stock only'),
              value: _inStock,
              onChanged: (v) => setState(() => _inStock = v),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: () => Navigator.pop(
                context,
                widget.initial.copyWith(
                  sort: _sort,
                  city: () => _city,
                  minRating: () => _minRating,
                  inStock: _inStock,
                  minPrice: () => int.tryParse(_min.text),
                  maxPrice: () => int.tryParse(_max.text),
                ),
              ),
              child: const Text('Show results'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(
                context,
                widget.initial.copyWith(
                  sort: 'newest',
                  city: () => null,
                  minRating: () => null,
                  inStock: false,
                  minPrice: () => null,
                  maxPrice: () => null,
                ),
              ),
              child: const Text('Reset filters'),
            ),
          ],
        ),
      ),
    );
  }
}
