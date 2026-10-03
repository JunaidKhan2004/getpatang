import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../data/auth_models.dart';
import '../data/auth_repository.dart';

sealed class AuthState {
  const AuthState();
}

/// Restoring the session from secure storage on launch.
class AuthRestoring extends AuthState {
  const AuthRestoring();
}

class Unauthenticated extends AuthState {
  const Unauthenticated();
}

class Authenticated extends AuthState {
  const Authenticated(this.user);
  final AppUser user;
}

class AuthController extends Notifier<AuthState> {
  late final AuthRepository _repo = ref.read(authRepositoryProvider);
  late final TokenStorage _tokens = ref.read(tokenStorageProvider);

  @override
  AuthState build() {
    final sub = ref.read(sessionExpiredEventsProvider).stream.listen((_) => state = const Unauthenticated());
    ref.onDispose(sub.cancel);
    unawaited(_restore());
    return const AuthRestoring();
  }

  Future<void> _restore() async {
    if (await _tokens.read() == null) {
      state = const Unauthenticated();
      return;
    }
    try {
      state = Authenticated(await _repo.me());
    } on ApiException catch (e) {
      // Offline at launch: keep tokens, but treat as signed out until the next attempt.
      if (e.statusCode == 401) await _tokens.clear();
      state = const Unauthenticated();
    }
  }

  Future<void> _start(AuthSession session) async {
    await _tokens.save(session.tokens);
    state = Authenticated(session.user);
  }

  Future<void> login(String identifier, String password) async =>
      _start(await _repo.login(identifier: identifier, password: password));

  Future<void> register({required String fullName, required String email, String? phone, required String password}) =>
      _repo.register(fullName: fullName, email: email, phone: phone, password: password);

  Future<void> verifyAccount(String email, String code) async =>
      _start(await _repo.verifyAccount(email: email, code: code));

  Future<void> resendOtp(String email, OtpPurpose purpose) => _repo.resendOtp(email: email, purpose: purpose);

  Future<void> forgotPassword(String email) => _repo.forgotPassword(email);

  Future<void> resetPassword(String email, String code, String newPassword) =>
      _repo.resetPassword(email: email, code: code, newPassword: newPassword);

  Future<void> saveProfile({required String displayName, String? city, String? bio}) async {
    state = Authenticated(await _repo.saveProfile(displayName: displayName, city: city, bio: bio));
  }

  Future<void> logout() async {
    final tokens = await _tokens.read();
    if (tokens != null) {
      try {
        await _repo.logout(tokens.refreshToken);
      } on ApiException {
        // Server-side revoke is best effort; local sign-out always proceeds.
      }
    }
    await _tokens.clear();
    state = const Unauthenticated();
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
