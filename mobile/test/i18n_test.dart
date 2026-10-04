import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kite_platform/core/i18n/i18n.dart';
import 'package:kite_platform/core/i18n/strings_ur.dart';

/// Literal keys used with `.tr` / `.trf(` in lib/. Covers single literals and adjacent
/// literals split across lines, which is how every key in the app is written.
Set<String> _keysInSource() {
  final literal = RegExp(
    r"'((?:[^'\\\n]|\\.)*)'"
    '|'
    r'"((?:[^"\\\n]|\\.)*)"',
  );
  final chain = RegExp('(?:${literal.pattern}\\s*)+\\.(?:tr\\b|trf\\()');
  final keys = <String>{};
  for (final f in Directory('lib').listSync(recursive: true).whereType<File>()) {
    if (!f.path.endsWith('.dart') || f.path.contains('i18n')) continue;
    final src = f.readAsStringSync();
    for (final m in chain.allMatches(src)) {
      final parts = literal.allMatches(m.group(0)!).map((p) => p.group(1) ?? p.group(2)!);
      final key = parts
          .join()
          .replaceAll(r"\'", "'")
          .replaceAll(r'\"', '"')
          .replaceAll(r'\n', '\n')
          .replaceAll(r'\$', r'$');
      if (key.contains(r'$')) continue; // interpolation, not a key
      keys.add(key);
    }
  }
  return keys;
}

final _placeholder = RegExp(r'\{(\w+)\}');
Set<String> _holes(String s) => _placeholder.allMatches(s).map((m) => m.group(1)!).toSet();

void main() {
  test('every sentence in the app has an Urdu translation', () {
    final keys = _keysInSource();
    expect(keys.length, greaterThan(400));
    final missing = [
      for (final k in keys)
        // Pure formatting ("{a} · {b}") needs no translation.
        if (!urStrings.containsKey(k) && RegExp('[A-Za-z]{2,}').hasMatch(k.replaceAll(_placeholder, ''))) k,
    ];
    expect(missing, isEmpty, reason: 'Add these to lib/core/i18n/strings_ur.dart');
  });

  test('Urdu keeps the placeholders of the English sentence', () {
    for (final e in urStrings.entries) {
      // Plural suffixes like guest{s} have no Urdu equivalent and may be dropped.
      expect(_holes(e.value).difference(_holes(e.key)), isEmpty, reason: e.key);
      expect(_holes(e.key).difference(_holes(e.value)).difference({'s'}), isEmpty, reason: e.key);
    }
  });

  test('tr and trf switch with the language and fall back to English', () {
    addTearDown(() => AppLang.code = 'en');
    AppLang.code = 'en';
    expect('Cart'.tr, 'Cart');
    AppLang.code = 'ur';
    expect('Cart'.tr, 'کارٹ');
    const fsi = '\u{2068}', pdi = '\u{2069}';
    expect('Order {orderNumber}'.trf({'orderNumber': 'GP-1'}), 'آرڈر ${fsi}GP-1$pdi');
    expect('Not a real sentence'.tr, 'Not a real sentence');
    expect(monthName(1), 'جنوری');
  });
}
