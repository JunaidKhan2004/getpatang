import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/widgets/feedback.dart';
import '../data/marketplace_repository.dart';
import '../data/models.dart';
import '../widgets/market_widgets.dart';
import '../../../core/widgets/loaders.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _q = TextEditingController();
  Timer? _debounce;
  String _query = '';
  bool _loading = false;
  String? _error;
  ({List<ProductCardData> products, List<ShopCardData> shops})? _result;

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _run(v.trim()));
  }

  Future<void> _run(String q) async {
    if (q == _query) return;
    _query = q;
    if (q.length < 2) {
      setState(() => _result = null);
      return;
    }
    setState(() => _loading = true);
    try {
      final r = await ref.read(marketplaceRepositoryProvider).search(q);
      if (mounted && q == _query) {
        setState(() {
          _result = r;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _retry() {
    final q = _q.text.trim();
    _query = '';
    _run(q);
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final r = _result;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _q,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onChanged: _onChanged,
          onSubmitted: (v) => _run(v.trim()),
          decoration: const InputDecoration(
            hintText: 'Search kites, shops…',
            isDense: true,
            prefixIcon: Icon(Icons.search),
          ),
        ),
        actions: const [SizedBox(width: 12)],
      ),
      body: _loading && r == null
          ? CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: ProductGridSkeleton(gridDelegate: productGridDelegate(context)),
                ),
              ],
            )
          : _error != null
          ? ErrorRetry(message: _error!, onRetry: _retry)
          : r == null
          ? const EmptyState(
              icon: Icons.search,
              title: 'Search the platform',
              message: 'Type at least 2 characters to find products and shops.',
            )
          : r.products.isEmpty && r.shops.isEmpty
          ? EmptyState(
              icon: Icons.search_off,
              title: 'Nothing found',
              message: 'No results for “$_query”. Try a more general word.',
            )
          : CustomScrollView(
              slivers: [
                if (r.shops.isNotEmpty) ...[
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    sliver: SliverToBoxAdapter(child: Text('Shops', style: t.textTheme.titleLarge)),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverList.separated(
                      itemCount: r.shops.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => ShopTile(shop: r.shops[i]),
                    ),
                  ),
                ],
                if (r.products.isNotEmpty) ...[
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                    sliver: SliverToBoxAdapter(child: Text('Products', style: t.textTheme.titleLarge)),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    sliver: SliverGrid.builder(
                      gridDelegate: productGridDelegate(context),
                      itemCount: r.products.length,
                      itemBuilder: (_, i) => ProductTile(product: r.products[i]),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}
