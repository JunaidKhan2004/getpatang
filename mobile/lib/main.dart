import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/i18n/i18n.dart';
import 'core/i18n/language.dart';
import 'core/theme/app_theme.dart';
import 'router/app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  AppLang.load(prefs);
  runApp(LanguageRoot(prefs: prefs, child: const KiteApp()));
}

class KiteApp extends ConsumerWidget {
  const KiteApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'GetPatang'.tr,
    debugShowCheckedModeBanner: false,
    locale: Locale(AppLang.code),
    supportedLocales: const [Locale('en'), Locale('ur')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    theme: AppTheme.light,
    darkTheme: AppTheme.dark,
    themeMode: ThemeMode.system,
    routerConfig: ref.watch(routerProvider),
  );
}
