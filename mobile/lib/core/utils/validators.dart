import '../i18n/i18n.dart';

/// Form validators. Keep rules in sync with the backend DTOs (backend/src/modules/auth/dto).
abstract final class Validators {
  static final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');
  // Pakistani mobile: 03XXXXXXXXX or +923XXXXXXXXX
  static final _pkPhone = RegExp(r'^(\+92|0)3\d{9}$');

  static String? required(String? v, [String? label]) =>
      (v == null || v.trim().isEmpty) ? '{label} is required'.trf({'label': label ?? 'This field'.tr}) : null;

  static String? email(String? v) {
    if (v == null || v.trim().isEmpty) return 'Email is required'.tr;
    return _email.hasMatch(v.trim()) ? null : 'Enter a valid email address'.tr;
  }

  static String? optionalPhone(String? v) {
    if (v == null || v.trim().isEmpty) return null;
    return _pkPhone.hasMatch(v.replaceAll(RegExp(r'[\s-]'), '')) ? null : 'Use the format 03XX XXXXXXX'.tr;
  }

  static String? password(String? v) {
    if (v == null || v.isEmpty) return 'Password is required'.tr;
    if (v.length < 8) return 'Use at least 8 characters'.tr;
    if (!RegExp(r'[A-Za-z]').hasMatch(v) || !RegExp(r'\d').hasMatch(v)) {
      return 'Include at least one letter and one number'.tr;
    }
    return null;
  }

  static String? Function(String?) confirm(String Function() original) =>
      (v) => v == original() ? null : 'Passwords do not match'.tr;

  static String? otp(String? v) => (v != null && RegExp(r'^\d{6}$').hasMatch(v)) ? null : 'Enter the 6-digit code'.tr;

  static String? name(String? v, [String? label]) {
    final shown = label ?? 'Name'.tr;
    final r = required(v, shown);
    if (r != null) return r;
    return v!.trim().length < 2 ? '{label} is too short'.trf({'label': shown}) : null;
  }
}
