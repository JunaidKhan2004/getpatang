import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/env.dart';
import '../storage/token_storage.dart';
import '../i18n/i18n.dart';

/// Error shown to users. Never contains raw technical details.
class ApiException implements Exception {
  const ApiException(this.message, {this.code, this.statusCode, this.fieldErrors = const {}});

  final String message;
  final String? code;
  final int? statusCode;
  final Map<String, String> fieldErrors;

  factory ApiException.fromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      final err = data['error'] as Map;
      final fields = <String, String>{};
      final details = err['details'];
      if (details is List) {
        for (final d in details) {
          if (d is Map && d['field'] != null) fields['${d['field']}'] = '${d['message']}';
        }
      }
      return ApiException(
        '${err['message'] ?? 'Something went wrong. Please try again.'.tr}',
        code: err['code'] as String?,
        statusCode: e.response?.statusCode,
        fieldErrors: fields,
      );
    }
    return switch (e.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.receiveTimeout ||
      DioExceptionType.sendTimeout => ApiException('The connection timed out. Check your internet and try again.'.tr),
      DioExceptionType.connectionError => ApiException(
        'Could not reach the server. Check your internet connection.'.tr,
      ),
      _ => ApiException('Something went wrong. Please try again.'.tr),
    };
  }

  @override
  String toString() => message;
}

/// Called when the session can no longer be refreshed (forces logout).
typedef SessionExpiredCallback = void Function();

class ApiClient {
  ApiClient(this._tokens, {SessionExpiredCallback? onSessionExpired})
    : _onSessionExpired = onSessionExpired, // ignore: prefer_initializing_formals
      dio = Dio(
        BaseOptions(
          baseUrl: Env.apiBaseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 20),
          headers: {'Accept': 'application/json'},
        ),
      ) {
    dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onRequest: (options, handler) async {
          options.headers['Accept-Language'] = AppLang.code;
          final tokens = await _tokens.read();
          if (tokens != null && options.extra['skipAuth'] != true) {
            options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isAuthCall = error.requestOptions.extra['skipAuth'] == true;
          if (error.response?.statusCode != 401 || isAuthCall) return handler.next(error);

          final refreshed = await _refresh();
          if (!refreshed) {
            _onSessionExpired?.call();
            return handler.next(error);
          }
          final tokens = await _tokens.read();
          final retry = error.requestOptions..headers['Authorization'] = 'Bearer ${tokens!.accessToken}';
          try {
            handler.resolve(await dio.fetch(retry));
          } on DioException catch (e) {
            handler.next(e);
          }
        },
      ),
    );
  }

  final Dio dio;
  final TokenStorage _tokens;
  final SessionExpiredCallback? _onSessionExpired;

  Future<bool> _refresh() async {
    final current = await _tokens.read();
    if (current == null) return false;
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': current.refreshToken},
        options: Options(extra: {'skipAuth': true}),
      );
      await _tokens.save(AuthTokens.fromJson(res.data!['data']['tokens'] as Map<String, dynamic>));
      return true;
    } on DioException {
      await _tokens.clear();
      return false;
    }
  }

  /// Unwraps the `{ data: ... }` envelope and maps errors to [ApiException].
  Future<T> request<T>(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool auth = true,
  }) async {
    try {
      final res = await dio.request<Map<String, dynamic>>(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method, extra: {'skipAuth': !auth}),
      );
      return res.data?['data'] as T;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

/// Emits when the refresh token is rejected; the auth controller listens and signs out.
final sessionExpiredEventsProvider = Provider<StreamController<void>>((ref) {
  final controller = StreamController<void>.broadcast();
  ref.onDispose(controller.close);
  return controller;
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final events = ref.watch(sessionExpiredEventsProvider);
  return ApiClient(ref.watch(tokenStorageProvider), onSessionExpired: () => events.add(null));
});
