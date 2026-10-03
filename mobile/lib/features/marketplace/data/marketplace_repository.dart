import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models.dart';

/// Product list filters. Mirrors backend ProductQueryDto.
class ProductFilters {
  const ProductFilters({
    this.q,
    this.category,
    this.city,
    this.minPrice,
    this.maxPrice,
    this.minRating,
    this.inStock = false,
    this.sort = 'newest',
    this.shop,
  });

  final String? q;
  final String? category;
  final String? city;
  final int? minPrice;
  final int? maxPrice;
  final int? minRating;
  final bool inStock;
  final String sort;
  final String? shop;

  bool get isFiltered => city != null || minPrice != null || maxPrice != null || minRating != null || inStock;

  ProductFilters copyWith({
    String? Function()? q,
    String? Function()? category,
    String? Function()? city,
    int? Function()? minPrice,
    int? Function()? maxPrice,
    int? Function()? minRating,
    bool? inStock,
    String? sort,
  }) => ProductFilters(
    q: q != null ? q() : this.q,
    category: category != null ? category() : this.category,
    city: city != null ? city() : this.city,
    minPrice: minPrice != null ? minPrice() : this.minPrice,
    maxPrice: maxPrice != null ? maxPrice() : this.maxPrice,
    minRating: minRating != null ? minRating() : this.minRating,
    inStock: inStock ?? this.inStock,
    sort: sort ?? this.sort,
    shop: shop,
  );

  Map<String, dynamic> toQuery() => {
    if (q != null && q!.isNotEmpty) 'q': q,
    if (category != null) 'category': category,
    if (city != null) 'city': city,
    if (minPrice != null) 'minPrice': minPrice,
    if (maxPrice != null) 'maxPrice': maxPrice,
    if (minRating != null) 'minRating': minRating,
    if (inStock) 'inStock': 'true',
    if (shop != null) 'shop': shop,
    'sort': sort,
  };

  @override
  bool operator ==(Object other) => other is ProductFilters && other.toQuery().toString() == toQuery().toString();

  @override
  int get hashCode => toQuery().toString().hashCode;
}

class MarketplaceRepository {
  MarketplaceRepository(this._api);
  final ApiClient _api;

  /// Paginated endpoints return `{ data, meta }`, so they bypass [ApiClient.request]'s unwrapping.
  Future<PageResult<T>> _page<T>(
    String path,
    Map<String, dynamic> query,
    T Function(Map<String, dynamic>) parse,
  ) async {
    try {
      final res = await _api.dio.get<Map<String, dynamic>>(path, queryParameters: query);
      final body = res.data!;
      final meta = body['meta'] as Map<String, dynamic>;
      return PageResult(
        [for (final j in (body['data'] as List)) parse(j as Map<String, dynamic>)],
        meta['page'] as int,
        meta['totalPages'] as int,
        meta['total'] as int,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<CategoryData>> categories() async => [
    for (final c in await _api.request<List<dynamic>>('GET', '/categories', auth: false))
      CategoryData.fromJson(c as Map<String, dynamic>),
  ];

  Future<PageResult<ProductCardData>> products(ProductFilters f, {int page = 1, int pageSize = 20}) =>
      _page('/products', {...f.toQuery(), 'page': page, 'pageSize': pageSize}, ProductCardData.fromJson);

  Future<ProductDetailData> product(String slug) async =>
      ProductDetailData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/products/$slug'));

  Future<PageResult<ReviewData>> reviews(String slug) =>
      _page('/products/$slug/reviews', {'pageSize': 5}, ReviewData.fromJson);

  Future<PageResult<ShopCardData>> shops({int page = 1, String? q}) =>
      _page('/shops', {'page': page, 'pageSize': 20, 'sort': 'popular', 'q': ?q}, ShopCardData.fromJson);

  Future<ShopDetailData> shop(String slug) async =>
      ShopDetailData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/shops/$slug'));

  Future<int> setFollow(String slug, bool follow) async {
    final res = await _api.request<Map<String, dynamic>>(follow ? 'PUT' : 'DELETE', '/shops/$slug/follow');
    return res['followerCount'] as int;
  }

  Future<({List<ProductCardData> products, List<ShopCardData> shops})> search(String q) async {
    final res = await _api.request<Map<String, dynamic>>('GET', '/search', query: {'q': q}, auth: false);
    return (
      products: [for (final p in (res['products'] as List)) ProductCardData.fromJson(p as Map<String, dynamic>)],
      shops: [
        for (final s in (res['shops'] as List)) ShopCardData.fromJson({...s as Map<String, dynamic>}),
      ],
    );
  }

  Future<void> setWishlist(String productId, bool saved) =>
      _api.request<Map<String, dynamic>>(saved ? 'PUT' : 'DELETE', '/wishlist/$productId');

  Future<PageResult<ProductCardData>> wishlist({int page = 1}) =>
      _page('/wishlist', {'page': page, 'pageSize': 20}, ProductCardData.fromJson);

  // Cart
  Future<CartData> cart() async => CartData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/cart'));

  Future<int> cartCount() async => (await _api.request<Map<String, dynamic>>('GET', '/cart/count'))['itemCount'] as int;

  Future<CartData> addToCart(String productId, {String? variantId, int quantity = 1}) async => CartData.fromJson(
    await _api.request<Map<String, dynamic>>(
      'POST',
      '/cart/items',
      body: {'productId': productId, 'variantId': ?variantId, 'quantity': quantity},
    ),
  );

  Future<CartData> updateCartItem(String id, {int? quantity, bool? savedForLater}) async => CartData.fromJson(
    await _api.request<Map<String, dynamic>>(
      'PATCH',
      '/cart/items/$id',
      body: {'quantity': ?quantity, 'savedForLater': ?savedForLater},
    ),
  );

  Future<CartData> removeCartItem(String id) async =>
      CartData.fromJson(await _api.request<Map<String, dynamic>>('DELETE', '/cart/items/$id'));

  // Checkout
  Future<List<AddressData>> addresses() async => [
    for (final a in await _api.request<List<dynamic>>('GET', '/addresses'))
      AddressData.fromJson(a as Map<String, dynamic>),
  ];

  Future<AddressData> createAddress(Map<String, dynamic> body) async =>
      AddressData.fromJson(await _api.request<Map<String, dynamic>>('POST', '/addresses', body: body));

  Future<({List<OptionData> delivery, List<OptionData> payment})> checkoutOptions() async {
    final res = await _api.request<Map<String, dynamic>>('GET', '/checkout/options');
    return (
      delivery: [
        for (final m in (res['deliveryMethods'] as List))
          OptionData(
            (m as Map)['key'] as String,
            m['label'] as String,
            m['description'] as String,
            fee: m['fee'] as int,
            freeAbove: m['freeAbove'] as int?,
          ),
      ],
      payment: [
        for (final m in (res['paymentMethods'] as List))
          OptionData((m as Map)['key'] as String, m['label'] as String, m['description'] as String),
      ],
    );
  }

  Future<QuoteData> quote(String deliveryMethod, String? couponCode) async => QuoteData.fromJson(
    await _api.request<Map<String, dynamic>>(
      'POST',
      '/checkout/quote',
      body: {'deliveryMethod': deliveryMethod, 'couponCode': ?couponCode},
    ),
  );

  Future<({String checkoutId, String? instructions, int total, List<String> orderNumbers})> placeOrder({
    required String checkoutId,
    required String addressId,
    required String deliveryMethod,
    required String paymentMethod,
    String? couponCode,
    String? notes,
  }) async {
    final res = await _api.request<Map<String, dynamic>>(
      'POST',
      '/checkout',
      body: {
        'checkoutId': checkoutId,
        'addressId': addressId,
        'deliveryMethod': deliveryMethod,
        'paymentMethod': paymentMethod,
        'couponCode': ?couponCode,
        'notes': ?notes,
      },
    );
    return (
      checkoutId: res['checkoutId'] as String,
      instructions: res['paymentInstructions'] as String?,
      total: res['total'] as int,
      orderNumbers: [for (final o in (res['orders'] as List)) (o as Map)['orderNumber'] as String],
    );
  }

  // Orders
  Future<PageResult<OrderSummaryData>> orders({int page = 1}) =>
      _page('/orders', {'page': page, 'pageSize': 20}, OrderSummaryData.fromJson);

  Future<OrderDetailData> order(String number) async =>
      OrderDetailData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/orders/$number'));

  Future<String> submitPaymentProof(String number, String reference, {String? proofUploadId}) async {
    final res = await _api.request<Map<String, dynamic>>(
      'POST',
      '/orders/$number/payment-proof',
      body: {'reference': reference, 'proofUploadId': ?proofUploadId},
    );
    return res['message'] as String;
  }

  Future<String> uploadPaymentProof(String path, String filename) async {
    try {
      final res = await _api.dio.post<Map<String, dynamic>>(
        '/uploads',
        queryParameters: {'purpose': 'payment_proof'},
        data: FormData.fromMap({'file': await MultipartFile.fromFile(path, filename: filename)}),
      );
      return (res.data!['data'] as Map)['id'] as String;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<OrderDetailData> cancelOrder(String number, String? reason) async => OrderDetailData.fromJson(
    await _api.request<Map<String, dynamic>>('POST', '/orders/$number/cancel', body: {'reason': ?reason}),
  );

  Future<void> review(String slug, int rating, String? comment) => _api.request<Map<String, dynamic>>(
    'POST',
    '/products/$slug/reviews',
    body: {'rating': rating, 'comment': ?comment},
  );
}

final marketplaceRepositoryProvider = Provider((ref) => MarketplaceRepository(ref.watch(apiClientProvider)));

// Read-side providers. Screens invalidate these after a change.
final categoriesProvider = FutureProvider((ref) => ref.watch(marketplaceRepositoryProvider).categories());

final productProvider = FutureProvider.autoDispose.family<ProductDetailData, String>(
  (ref, slug) => ref.watch(marketplaceRepositoryProvider).product(slug),
);

final productReviewsProvider = FutureProvider.autoDispose.family<PageResult<ReviewData>, String>(
  (ref, slug) => ref.watch(marketplaceRepositoryProvider).reviews(slug),
);

final shopProvider = FutureProvider.autoDispose.family<ShopDetailData, String>(
  (ref, slug) => ref.watch(marketplaceRepositoryProvider).shop(slug),
);

final cartProvider = FutureProvider.autoDispose((ref) => ref.watch(marketplaceRepositoryProvider).cart());

final orderProvider = FutureProvider.autoDispose.family<OrderDetailData, String>(
  (ref, number) => ref.watch(marketplaceRepositoryProvider).order(number),
);

final homeFeedProvider = FutureProvider.autoDispose((ref) async {
  final repo = ref.watch(marketplaceRepositoryProvider);
  final results = await Future.wait([
    repo.products(const ProductFilters(sort: 'popular', inStock: true), pageSize: 8),
    repo.shops(),
  ]);
  return (
    products: (results[0] as PageResult<ProductCardData>).items,
    shops: (results[1] as PageResult<ShopCardData>).items.take(5).toList(),
  );
});
