import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../marketplace/data/models.dart' show PageResult;
import 'kite_design.dart';
import '../../core/i18n/i18n.dart';

class SavedDesign {
  const SavedDesign(this.id, this.name, this.design, this.updatedAt);
  final String id;
  final String name;
  final KiteDesign design;
  final DateTime updatedAt;

  factory SavedDesign.fromJson(Map<String, dynamic> j) => SavedDesign(
    j['id'] as String,
    j['name'] as String,
    KiteDesign.fromJson(j['design'] as Map<String, dynamic>),
    DateTime.parse(j['updatedAt'] as String).toLocal(),
  );
}

class CustomShop {
  const CustomShop(this.id, this.name, this.city, this.isVerified);
  final String id;
  final String name;
  final String city;
  final bool isVerified;
}

const customStatusLabels = {
  'REQUESTED': 'Waiting for the shop',
  'CLARIFICATION_NEEDED': 'Shop has a question',
  'QUOTED': 'Quote received',
  'ACCEPTED': 'Accepted, order placed',
  'DECLINED': 'Quote declined',
  'REJECTED': 'Shop declined',
  'CANCELLED': 'Cancelled',
};

class CustomOrderData {
  const CustomOrderData({
    required this.id,
    required this.number,
    required this.status,
    required this.quoteExpired,
    required this.designName,
    required this.design,
    required this.quantity,
    required this.requirements,
    required this.budget,
    required this.deadline,
    required this.quotePrice,
    required this.quoteDays,
    required this.quoteNote,
    required this.quoteValidUntil,
    required this.shopName,
    required this.orderNumber,
    required this.messages,
    required this.createdAt,
  });

  final String id;
  final String number;
  final String status;
  final bool quoteExpired;
  final String designName;
  final KiteDesign design;
  final int quantity;
  final String requirements;
  final int? budget;
  final DateTime? deadline;
  final int? quotePrice;
  final int? quoteDays;
  final String? quoteNote;
  final DateTime? quoteValidUntil;
  final String shopName;
  final String? orderNumber;
  final List<({String role, String body, DateTime at, String? author})> messages;
  final DateTime createdAt;

  bool get isOpen => const ['REQUESTED', 'CLARIFICATION_NEEDED', 'QUOTED'].contains(status);
  bool get canAccept => status == 'QUOTED' && !quoteExpired;
  String get statusLabel => quoteExpired ? 'Quote expired'.tr : customStatusLabels[status]?.tr ?? status;

  static DateTime? _d(Object? v) => v == null ? null : DateTime.parse(v as String).toLocal();

  factory CustomOrderData.fromJson(Map<String, dynamic> j) {
    final q = j['quote'] as Map?;
    return CustomOrderData(
      id: j['id'] as String,
      number: j['number'] as String,
      status: j['status'] as String,
      quoteExpired: j['quoteExpired'] as bool,
      designName: j['designName'] as String,
      design: KiteDesign.fromJson(j['design'] as Map<String, dynamic>),
      quantity: j['quantity'] as int,
      requirements: j['requirements'] as String,
      budget: j['budget'] as int?,
      deadline: _d(j['deadline']),
      quotePrice: q?['price'] as int?,
      quoteDays: q?['deliveryDays'] as int?,
      quoteNote: q?['note'] as String?,
      quoteValidUntil: _d(q?['validUntil']),
      shopName: (j['shop'] as Map)['name'] as String,
      orderNumber: (j['order'] as Map?)?['orderNumber'] as String?,
      messages: [
        for (final m in j['messages'] as List)
          (
            role: (m as Map)['role'] as String,
            body: m['body'] as String,
            at: DateTime.parse(m['createdAt'] as String).toLocal(),
            author: m['author'] as String?,
          ),
      ],
      createdAt: DateTime.parse(j['createdAt'] as String).toLocal(),
    );
  }
}

class DesignerRepository {
  DesignerRepository(this._api);
  final ApiClient _api;

  Future<List<SavedDesign>> designs() async => [
    for (final d in await _api.request<List<dynamic>>('GET', '/designs'))
      SavedDesign.fromJson(d as Map<String, dynamic>),
  ];

  Future<SavedDesign> design(String id) async =>
      SavedDesign.fromJson(await _api.request<Map<String, dynamic>>('GET', '/designs/$id'));

  Future<SavedDesign> save(String? id, String name, KiteDesign design) async => SavedDesign.fromJson(
    await _api.request<Map<String, dynamic>>(
      id == null ? 'POST' : 'PUT',
      id == null ? '/designs' : '/designs/$id',
      body: {'name': name, 'design': design.toJson()},
    ),
  );

  Future<void> delete(String id) => _api.request<Map<String, dynamic>>('DELETE', '/designs/$id');

  Future<({String id, String url})> uploadImage(String path, String filename) async {
    try {
      final res = await _api.dio.post<Map<String, dynamic>>(
        '/uploads',
        queryParameters: {'purpose': 'design_asset'},
        data: FormData.fromMap({'file': await MultipartFile.fromFile(path, filename: filename)}),
      );
      final d = res.data!['data'] as Map;
      return (id: d['id'] as String, url: d['url'] as String);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<CustomShop>> shops() async => [
    for (final s in await _api.request<List<dynamic>>('GET', '/custom-orders/shops', auth: false))
      CustomShop((s as Map)['id'] as String, s['name'] as String, s['city'] as String, s['isVerified'] as bool),
  ];

  Future<CustomOrderData> create(Map<String, dynamic> body) async =>
      CustomOrderData.fromJson(await _api.request<Map<String, dynamic>>('POST', '/custom-orders', body: body));

  Future<PageResult<CustomOrderData>> requests({int page = 1}) async {
    try {
      final res = await _api.dio.get<Map<String, dynamic>>(
        '/custom-orders',
        queryParameters: {'page': page, 'pageSize': 20},
      );
      final meta = res.data!['meta'] as Map<String, dynamic>;
      return PageResult(
        [for (final j in (res.data!['data'] as List)) CustomOrderData.fromJson(j as Map<String, dynamic>)],
        meta['page'] as int,
        meta['totalPages'] as int,
        meta['total'] as int,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<CustomOrderData> request(String id) async =>
      CustomOrderData.fromJson(await _api.request<Map<String, dynamic>>('GET', '/custom-orders/$id'));

  Future<void> message(String id, String body) =>
      _api.request<Map<String, dynamic>>('POST', '/custom-orders/$id/messages', body: {'body': body});

  Future<void> command(String id, String command) =>
      _api.request<Map<String, dynamic>>('POST', '/custom-orders/$id/$command');

  Future<String> accept(
    String id, {
    required String addressId,
    required String delivery,
    required String payment,
  }) async {
    final res = await _api.request<Map<String, dynamic>>(
      'POST',
      '/custom-orders/$id/accept',
      body: {'addressId': addressId, 'deliveryMethod': delivery, 'paymentMethod': payment},
    );
    return (res['order'] as Map)['orderNumber'] as String;
  }
}

final designerRepositoryProvider = Provider((ref) => DesignerRepository(ref.watch(apiClientProvider)));
final myDesignsProvider = FutureProvider.autoDispose((ref) => ref.watch(designerRepositoryProvider).designs());
final customOrderProvider = FutureProvider.autoDispose.family<CustomOrderData, String>(
  (ref, id) => ref.watch(designerRepositoryProvider).request(id),
);
