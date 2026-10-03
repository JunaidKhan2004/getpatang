/// Marketplace models. Mirror backend/src/modules/catalog, shopping and orders responses.
library;

/// "Rs 1,250" — same grouping as the website (en-PK).
String formatPKR(num n) {
  final digits = n.round().abs().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  return 'Rs ${n < 0 ? '-' : ''}$digits';
}

class ImageRef {
  const ImageRef(this.url, this.alt);
  final String url;
  final String? alt;

  static ImageRef? fromJson(Object? json) =>
      json is Map<String, dynamic> ? ImageRef(json['url'] as String, json['alt'] as String?) : null;
}

class ShopRef {
  const ShopRef({required this.name, required this.slug, required this.city, this.isVerified = false, this.id});
  final String? id;
  final String name;
  final String slug;
  final String city;
  final bool isVerified;

  factory ShopRef.fromJson(Map<String, dynamic> j) => ShopRef(
    id: j['id'] as String?,
    name: j['name'] as String,
    slug: j['slug'] as String,
    city: j['city'] as String,
    isVerified: j['isVerified'] as bool? ?? false,
  );
}

class ProductCardData {
  const ProductCardData({
    required this.id,
    required this.slug,
    required this.title,
    required this.price,
    required this.compareAtPrice,
    required this.hasVariants,
    required this.image,
    required this.ratingAvg,
    required this.ratingCount,
    required this.inStock,
    required this.shop,
  });

  final String id;
  final String slug;
  final String title;
  final int price;
  final int? compareAtPrice;
  final bool hasVariants;
  final ImageRef? image;
  final double ratingAvg;
  final int ratingCount;
  final bool inStock;
  final ShopRef shop;

  factory ProductCardData.fromJson(Map<String, dynamic> j) => ProductCardData(
    id: j['id'] as String,
    slug: j['slug'] as String,
    title: j['title'] as String,
    price: j['price'] as int,
    compareAtPrice: j['compareAtPrice'] as int?,
    hasVariants: j['hasVariants'] as bool? ?? false,
    image: ImageRef.fromJson(j['image']),
    ratingAvg: (j['ratingAvg'] as num).toDouble(),
    ratingCount: j['ratingCount'] as int,
    inStock: j['inStock'] as bool,
    shop: ShopRef.fromJson(j['shop'] as Map<String, dynamic>),
  );
}

class ShopCardData {
  const ShopCardData({
    required this.id,
    required this.name,
    required this.slug,
    required this.city,
    required this.isVerified,
    required this.ratingAvg,
    required this.ratingCount,
    required this.followerCount,
    this.logoUrl,
    this.productCount,
  });

  final String id;
  final String name;
  final String slug;
  final String city;
  final bool isVerified;
  final double ratingAvg;
  final int ratingCount;
  final int followerCount;
  final String? logoUrl;
  final int? productCount;

  factory ShopCardData.fromJson(Map<String, dynamic> j) => ShopCardData(
    id: j['id'] as String,
    name: j['name'] as String,
    slug: j['slug'] as String,
    city: j['city'] as String,
    isVerified: j['isVerified'] as bool,
    ratingAvg: (j['ratingAvg'] as num).toDouble(),
    ratingCount: j['ratingCount'] as int,
    followerCount: j['followerCount'] as int,
    logoUrl: j['logoUrl'] as String?,
    productCount: j['productCount'] as int?,
  );
}

class ShopDetailData extends ShopCardData {
  const ShopDetailData({
    required super.id,
    required super.name,
    required super.slug,
    required super.city,
    required super.isVerified,
    required super.ratingAvg,
    required super.ratingCount,
    required super.followerCount,
    super.logoUrl,
    super.productCount,
    this.description,
    this.phone,
    this.email,
    this.address,
    required this.isFollowing,
  });

  final String? description;
  final String? phone;
  final String? email;
  final String? address;
  final bool isFollowing;

  factory ShopDetailData.fromJson(Map<String, dynamic> j) {
    final c = ShopCardData.fromJson(j);
    return ShopDetailData(
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      isVerified: c.isVerified,
      ratingAvg: c.ratingAvg,
      ratingCount: c.ratingCount,
      followerCount: c.followerCount,
      logoUrl: c.logoUrl,
      productCount: c.productCount,
      description: j['description'] as String?,
      phone: j['phone'] as String?,
      email: j['email'] as String?,
      address: j['address'] as String?,
      isFollowing: j['isFollowing'] as bool? ?? false,
    );
  }
}

class CategoryData {
  const CategoryData({required this.name, required this.slug, required this.productCount, this.children = const []});
  final String name;
  final String slug;
  final int productCount;
  final List<CategoryData> children;

  int get totalCount => productCount + children.fold(0, (n, c) => n + c.productCount);

  factory CategoryData.fromJson(Map<String, dynamic> j) => CategoryData(
    name: j['name'] as String,
    slug: j['slug'] as String,
    productCount: j['productCount'] as int,
    children: ((j['children'] as List?) ?? []).map((c) => CategoryData.fromJson(c as Map<String, dynamic>)).toList(),
  );
}

class VariantData {
  const VariantData(this.id, this.name, this.price, this.stock);
  final String id;
  final String name;
  final int price;
  final int stock;
}

class ProductDetailData {
  const ProductDetailData({
    required this.id,
    required this.slug,
    required this.title,
    required this.description,
    required this.specifications,
    required this.shippingInfo,
    required this.price,
    required this.compareAtPrice,
    required this.stock,
    required this.images,
    required this.variants,
    required this.ratingAvg,
    required this.ratingCount,
    required this.shop,
    required this.isWishlisted,
    required this.related,
  });

  final String id;
  final String slug;
  final String title;
  final String description;
  final List<(String, String)> specifications;
  final String? shippingInfo;
  final int price;
  final int? compareAtPrice;
  final int stock;
  final List<ImageRef> images;
  final List<VariantData> variants;
  final double ratingAvg;
  final int ratingCount;
  final ShopRef shop;
  final bool isWishlisted;
  final List<ProductCardData> related;

  factory ProductDetailData.fromJson(Map<String, dynamic> j) => ProductDetailData(
    id: j['id'] as String,
    slug: j['slug'] as String,
    title: j['title'] as String,
    description: j['description'] as String,
    specifications: [
      for (final s in (j['specifications'] as List)) ((s as Map)['label'] as String, s['value'] as String),
    ],
    shippingInfo: j['shippingInfo'] as String?,
    price: j['price'] as int,
    compareAtPrice: j['compareAtPrice'] as int?,
    stock: j['stock'] as int,
    images: [for (final i in (j['images'] as List)) ImageRef.fromJson(i)!],
    variants: [
      for (final v in (j['variants'] as List))
        VariantData((v as Map)['id'] as String, v['name'] as String, v['price'] as int, v['stock'] as int),
    ],
    ratingAvg: (j['ratingAvg'] as num).toDouble(),
    ratingCount: j['ratingCount'] as int,
    shop: ShopRef.fromJson(j['shop'] as Map<String, dynamic>),
    isWishlisted: j['isWishlisted'] as bool? ?? false,
    related: [for (final p in (j['related'] as List)) ProductCardData.fromJson(p as Map<String, dynamic>)],
  );
}

class ReviewData {
  const ReviewData(this.rating, this.comment, this.authorName, this.createdAt);
  final int rating;
  final String? comment;
  final String authorName;
  final DateTime createdAt;

  factory ReviewData.fromJson(Map<String, dynamic> j) => ReviewData(
    j['rating'] as int,
    j['comment'] as String?,
    (j['author'] as Map)['name'] as String,
    DateTime.parse(j['createdAt'] as String),
  );
}

class CartLineData {
  const CartLineData({
    required this.id,
    required this.slug,
    required this.title,
    required this.variantName,
    required this.image,
    required this.unitPrice,
    required this.quantity,
    required this.lineTotal,
    required this.available,
    required this.savedForLater,
    required this.shop,
    required this.issue,
  });

  final String id;
  final String slug;
  final String title;
  final String? variantName;
  final ImageRef? image;
  final int unitPrice;
  final int quantity;
  final int lineTotal;
  final int available;
  final bool savedForLater;
  final ShopRef shop;
  final String? issue;

  factory CartLineData.fromJson(Map<String, dynamic> j) => CartLineData(
    id: j['id'] as String,
    slug: j['slug'] as String,
    title: j['title'] as String,
    variantName: j['variantName'] as String?,
    image: ImageRef.fromJson(j['image']),
    unitPrice: j['unitPrice'] as int,
    quantity: j['quantity'] as int,
    lineTotal: j['lineTotal'] as int,
    available: j['available'] as int,
    savedForLater: j['savedForLater'] as bool,
    shop: ShopRef.fromJson(j['shop'] as Map<String, dynamic>),
    issue: j['issue'] as String?,
  );
}

class CartShopGroup {
  const CartShopGroup(this.shop, this.items, this.subtotal);
  final ShopRef shop;
  final List<CartLineData> items;
  final int subtotal;
}

class CartData {
  const CartData({
    required this.shops,
    required this.savedForLater,
    required this.itemCount,
    required this.subtotal,
    required this.canCheckout,
  });
  final List<CartShopGroup> shops;
  final List<CartLineData> savedForLater;
  final int itemCount;
  final int subtotal;
  final bool canCheckout;

  factory CartData.fromJson(Map<String, dynamic> j) => CartData(
    shops: [
      for (final g in (j['shops'] as List))
        CartShopGroup(ShopRef.fromJson((g as Map)['shop'] as Map<String, dynamic>), [
          for (final i in (g['items'] as List)) CartLineData.fromJson(i as Map<String, dynamic>),
        ], g['subtotal'] as int),
    ],
    savedForLater: [for (final i in (j['savedForLater'] as List)) CartLineData.fromJson(i as Map<String, dynamic>)],
    itemCount: j['itemCount'] as int,
    subtotal: j['subtotal'] as int,
    canCheckout: j['canCheckout'] as bool,
  );
}

class AddressData {
  const AddressData({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.line1,
    required this.city,
    required this.isDefault,
    this.label,
    this.line2,
    this.postalCode,
  });

  final String id;
  final String fullName;
  final String phone;
  final String line1;
  final String? line2;
  final String city;
  final String? postalCode;
  final String? label;
  final bool isDefault;

  String get oneLine => [line1, line2, city, postalCode].whereType<String>().where((s) => s.isNotEmpty).join(', ');

  factory AddressData.fromJson(Map<String, dynamic> j) => AddressData(
    id: j['id'] as String,
    fullName: j['fullName'] as String,
    phone: j['phone'] as String,
    line1: j['line1'] as String,
    line2: j['line2'] as String?,
    city: j['city'] as String,
    postalCode: j['postalCode'] as String?,
    label: j['label'] as String?,
    isDefault: j['isDefault'] as bool,
  );
}

class OptionData {
  const OptionData(this.key, this.label, this.description, {this.fee, this.freeAbove});
  final String key;
  final String label;
  final String description;
  final int? fee;
  final int? freeAbove;
}

class QuoteData {
  const QuoteData({
    required this.subtotal,
    required this.shippingFee,
    required this.discount,
    required this.total,
    this.couponCode,
    required this.shopCount,
  });
  final int subtotal;
  final int shippingFee;
  final int discount;
  final int total;
  final String? couponCode;
  final int shopCount;

  factory QuoteData.fromJson(Map<String, dynamic> j) => QuoteData(
    subtotal: j['subtotal'] as int,
    shippingFee: j['shippingFee'] as int,
    discount: j['discount'] as int,
    total: j['total'] as int,
    couponCode: j['couponCode'] as String?,
    shopCount: (j['shops'] as List).length,
  );
}

const orderStatusLabels = {
  'PENDING': 'Pending',
  'CONFIRMED': 'Confirmed',
  'PREPARING': 'Preparing',
  'SHIPPED': 'Shipped',
  'OUT_FOR_DELIVERY': 'Out for delivery',
  'DELIVERED': 'Delivered',
  'CANCELLED': 'Cancelled',
  'REFUNDED': 'Refunded',
  'RETURNED': 'Returned',
};

class OrderSummaryData {
  const OrderSummaryData(this.orderNumber, this.status, this.total, this.createdAt, this.shopName, this.itemsText);
  final String orderNumber;
  final String status;
  final int total;
  final DateTime createdAt;
  final String shopName;
  final String itemsText;

  factory OrderSummaryData.fromJson(Map<String, dynamic> j) {
    final items = (j['items'] as List).map((i) => '${(i as Map)['quantity']} × ${i['title']}').join(', ');
    final extra = (j['itemCount'] as int) - (j['items'] as List).length;
    return OrderSummaryData(
      j['orderNumber'] as String,
      j['status'] as String,
      j['total'] as int,
      DateTime.parse(j['createdAt'] as String),
      (j['shop'] as Map)['name'] as String,
      extra > 0 ? '$items and $extra more' : items,
    );
  }
}

class OrderDetailData {
  const OrderDetailData({
    required this.orderNumber,
    required this.status,
    required this.createdAt,
    required this.subtotal,
    required this.shippingFee,
    required this.discount,
    required this.total,
    required this.address,
    required this.shopName,
    required this.shopPhone,
    required this.shopEmail,
    required this.items,
    required this.timeline,
    required this.progress,
    required this.paymentLabel,
    required this.paymentStatus,
    required this.paymentInstructions,
    required this.canCancel,
    this.paymentReference,
    this.paymentReviewNote,
    this.canSubmitProof = false,
    this.refunds = const [],
  });

  final String orderNumber;
  final String status;
  final DateTime createdAt;
  final int subtotal;
  final int shippingFee;
  final int discount;
  final int total;
  final String address;
  final String shopName;
  final String? shopPhone;
  final String? shopEmail;
  final List<({String title, String? variantName, int quantity, int lineTotal, String? productSlug, bool canReview})>
  items;
  final List<({String status, String? note, DateTime at})> timeline;
  final List<String> progress;
  final String? paymentLabel;
  final String? paymentStatus;
  final String? paymentInstructions;
  final bool canCancel;
  final String? paymentReference;
  final String? paymentReviewNote;
  final bool canSubmitProof;
  final List<({int amount, String status, String? reference})> refunds;

  factory OrderDetailData.fromJson(Map<String, dynamic> j) {
    final a = j['shippingAddress'] as Map;
    final payment = j['payment'] as Map?;
    return OrderDetailData(
      orderNumber: j['orderNumber'] as String,
      status: j['status'] as String,
      createdAt: DateTime.parse(j['createdAt'] as String),
      subtotal: j['subtotal'] as int,
      shippingFee: j['shippingFee'] as int,
      discount: j['discount'] as int,
      total: j['total'] as int,
      address:
          '${a['fullName']}\n${[a['line1'], a['line2'], a['city'], a['postalCode']].where((s) => s != null && '$s'.isNotEmpty).join(', ')}\n${a['phone']}',
      shopName: (j['shop'] as Map)['name'] as String,
      shopPhone: (j['shop'] as Map)['phone'] as String?,
      shopEmail: (j['shop'] as Map)['email'] as String?,
      items: [
        for (final i in (j['items'] as List))
          (
            title: (i as Map)['title'] as String,
            variantName: i['variantName'] as String?,
            quantity: i['quantity'] as int,
            lineTotal: i['lineTotal'] as int,
            productSlug: i['productSlug'] as String?,
            canReview: i['canReview'] as bool,
          ),
      ],
      timeline: [
        for (final t in (j['timeline'] as List))
          (
            status: (t as Map)['status'] as String,
            note: t['note'] as String?,
            at: DateTime.parse(t['createdAt'] as String),
          ),
      ],
      progress: (j['progress'] as List).cast<String>(),
      paymentLabel: payment?['label'] as String?,
      paymentStatus: payment?['status'] as String?,
      paymentInstructions: payment?['instructions'] as String?,
      canCancel: j['canCancel'] as bool,
      paymentReference: payment?['reference'] as String?,
      paymentReviewNote: payment?['reviewNote'] as String?,
      canSubmitProof: payment?['canSubmitProof'] as bool? ?? false,
      refunds: [
        for (final r in (j['refunds'] as List? ?? const []))
          (amount: (r as Map)['amount'] as int, status: r['status'] as String, reference: r['reference'] as String?),
      ],
    );
  }
}

const paymentStatusLabels = {
  'PENDING': 'Not paid yet',
  'VERIFYING': 'Being verified',
  'PAID': 'Paid',
  'FAILED': 'Closed',
  'REFUNDED': 'Refunded',
};

class PageResult<T> {
  const PageResult(this.items, this.page, this.totalPages, this.total);
  final List<T> items;
  final int page;
  final int totalPages;
  final int total;
  bool get hasMore => page < totalPages;
}
