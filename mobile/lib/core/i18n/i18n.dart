import 'dart:ui' show PlatformDispatcher;

import 'package:shared_preferences/shared_preferences.dart';

import 'strings_ur.dart';

/// App language. English sentences are the keys; [urStrings] maps them to Urdu and anything
/// missing falls back to English. Same scheme as the backend and the website.
abstract final class AppLang {
  static const _prefKey = 'locale';

  /// 'en' or 'ur'. Read by [Tr], the API client (Accept-Language) and the theme.
  static String code = 'en';
  static bool get isUrdu => code == 'ur';

  /// The user's explicit choice, or null to follow the phone language.
  static String? choice;

  static String get systemCode => PlatformDispatcher.instance.locale.languageCode == 'ur' ? 'ur' : 'en';

  static void load(SharedPreferences prefs) {
    final saved = prefs.getString(_prefKey);
    choice = saved == 'en' || saved == 'ur' ? saved : null;
    code = choice ?? systemCode;
  }

  static Future<void> save(SharedPreferences prefs, String? value) async {
    choice = value;
    code = value ?? systemCode;
    value == null ? await prefs.remove(_prefKey) : await prefs.setString(_prefKey, value);
  }
}

const _urMonths = [
  'جنوری',
  'فروری',
  'مارچ',
  'اپریل',
  'مئی',
  'جون',
  'جولائی',
  'اگست',
  'ستمبر',
  'اکتوبر',
  'نومبر',
  'دسمبر',
];
const _enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/// Short month name in the current language (1 = January).
String monthName(int month) => (AppLang.isUrdu ? _urMonths : _enMonths)[month - 1];

extension Tr on String {
  String get tr => AppLang.isUrdu ? (urStrings[this] ?? this) : this;

  /// In Urdu each value is wrapped in a first-strong isolate, so English values such as
  /// "GP-1042" keep their order inside a right-to-left sentence. Links are left untouched.
  String trf(Map<String, Object?> values) {
    var out = tr;
    values.forEach((k, v) {
      final text = '${v ?? ''}';
      final isolate = AppLang.isUrdu && text.isNotEmpty && !text.contains('/');
      out = out.replaceAll('{$k}', isolate ? '\u2068$text\u2069' : text);
    });
    return out;
  }
}
