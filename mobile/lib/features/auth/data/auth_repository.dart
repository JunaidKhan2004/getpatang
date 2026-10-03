import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import 'auth_models.dart';

class AuthSession {
  const AuthSession(this.user, this.tokens);
  final AppUser user;
  final AuthTokens tokens;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    AppUser.fromJson(json['user'] as Map<String, dynamic>),
    AuthTokens.fromJson(json['tokens'] as Map<String, dynamic>),
  );
}

/// Thin wrapper over the `/auth` and `/users/me` endpoints.
class AuthRepository {
  AuthRepository(this._api);
  final ApiClient _api;

  Future<AuthSession> login({required String identifier, required String password}) async {
    final data = await _api.request<Map<String, dynamic>>(
      'POST',
      '/auth/login',
      body: {'identifier': identifier, 'password': password},
      auth: false,
    );
    return AuthSession.fromJson(data);
  }

  /// Creates an unverified account; the backend sends a verification code to [email].
  Future<void> register({required String fullName, required String email, String? phone, required String password}) =>
      _api.request<Map<String, dynamic>>(
        'POST',
        '/auth/register',
        body: {
          'fullName': fullName,
          'email': email,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
          'password': password,
        },
        auth: false,
      );

  Future<AuthSession> verifyAccount({required String email, required String code}) async {
    final data = await _api.request<Map<String, dynamic>>(
      'POST',
      '/auth/verify-otp',
      body: {'email': email, 'code': code},
      auth: false,
    );
    return AuthSession.fromJson(data);
  }

  Future<void> resendOtp({required String email, required OtpPurpose purpose}) => _api.request<Map<String, dynamic>>(
    'POST',
    '/auth/resend-otp',
    body: {'email': email, 'purpose': purpose.value},
    auth: false,
  );

  Future<void> forgotPassword(String email) =>
      _api.request<Map<String, dynamic>>('POST', '/auth/forgot-password', body: {'email': email}, auth: false);

  Future<void> resetPassword({required String email, required String code, required String newPassword}) =>
      _api.request<Map<String, dynamic>>(
        'POST',
        '/auth/reset-password',
        body: {'email': email, 'code': code, 'newPassword': newPassword},
        auth: false,
      );

  Future<AppUser> me() async => AppUser.fromJson(await _api.request<Map<String, dynamic>>('GET', '/auth/me'));

  Future<AppUser> saveProfile({required String displayName, String? city, String? bio}) async {
    final data = await _api.request<Map<String, dynamic>>(
      'PUT',
      '/users/me/profile',
      body: {
        'displayName': displayName,
        if (city != null && city.isNotEmpty) 'city': city,
        if (bio != null && bio.isNotEmpty) 'bio': bio,
      },
    );
    return AppUser.fromJson(data);
  }

  Future<void> logout(String refreshToken) =>
      _api.request<Map<String, dynamic>>('POST', '/auth/logout', body: {'refreshToken': refreshToken});
}

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository(ref.watch(apiClientProvider)));
