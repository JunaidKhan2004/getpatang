import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../i18n/i18n.dart';
import 'app_colors.dart';

abstract final class AppRadius {
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 20.0;
}

abstract final class AppTheme {
  static ThemeData get light => _build(
    brightness: Brightness.light,
    scheme: const ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.maroon900,
      onPrimary: AppColors.white,
      primaryContainer: AppColors.maroon100,
      onPrimaryContainer: AppColors.maroon900,
      secondary: AppColors.maroon500,
      onSecondary: AppColors.white,
      error: AppColors.danger,
      onError: AppColors.white,
      surface: AppColors.white,
      onSurface: AppColors.ink,
      onSurfaceVariant: AppColors.muted,
      surfaceContainerHighest: AppColors.neutral100,
      outline: AppColors.neutral200,
      outlineVariant: AppColors.neutral200,
    ),
    background: AppColors.neutral50,
    fieldFill: AppColors.white,
  );

  static ThemeData get dark => _build(
    brightness: Brightness.dark,
    scheme: const ColorScheme(
      brightness: Brightness.dark,
      primary: AppColors.darkPrimary,
      onPrimary: AppColors.maroon950,
      primaryContainer: AppColors.maroon700,
      onPrimaryContainer: AppColors.darkText,
      secondary: AppColors.darkPrimary,
      onSecondary: AppColors.maroon950,
      error: Color(0xFFF0716A),
      onError: AppColors.maroon950,
      surface: AppColors.darkSurface,
      onSurface: AppColors.darkText,
      onSurfaceVariant: AppColors.darkMuted,
      surfaceContainerHighest: AppColors.darkSurface2,
      outline: AppColors.darkBorder,
      outlineVariant: AppColors.darkBorder,
    ),
    background: AppColors.darkBackground,
    fieldFill: AppColors.darkSurface,
  );

  static ThemeData _build({
    required Brightness brightness,
    required ColorScheme scheme,
    required Color background,
    required Color fieldFill,
  }) {
    final base = ThemeData(useMaterial3: true, brightness: brightness, colorScheme: scheme);
    final body = GoogleFonts.interTextTheme(base.textTheme);
    final display = GoogleFonts.poppinsTextTheme(base.textTheme);

    final latin = body
        .copyWith(
          headlineLarge: display.headlineLarge?.copyWith(fontSize: 32, fontWeight: FontWeight.w700, height: 1.15),
          headlineMedium: display.headlineMedium?.copyWith(fontSize: 24, fontWeight: FontWeight.w600, height: 1.2),
          headlineSmall: display.headlineSmall?.copyWith(fontSize: 20, fontWeight: FontWeight.w600),
          titleLarge: display.titleLarge?.copyWith(fontSize: 18, fontWeight: FontWeight.w600),
          titleMedium: display.titleMedium?.copyWith(fontSize: 16, fontWeight: FontWeight.w600),
          bodyLarge: body.bodyLarge?.copyWith(fontSize: 15, height: 1.5),
          bodyMedium: body.bodyMedium?.copyWith(fontSize: 14, height: 1.5),
          bodySmall: body.bodySmall?.copyWith(fontSize: 13, color: scheme.onSurfaceVariant),
          labelLarge: display.labelLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.w600),
          labelSmall: body.labelSmall?.copyWith(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.9),
        )
        .apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);
    final textTheme = AppLang.isUrdu ? _urdu(latin) : latin;

    final roundedMd = RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md));
    OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadius.md),
      borderSide: BorderSide(color: c, width: w),
    );

    return base.copyWith(
      scaffoldBackgroundColor: background,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: roundedMd,
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: roundedMd,
          side: BorderSide(color: scheme.outline),
          foregroundColor: scheme.onSurface,
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: scheme.primary, textStyle: textTheme.labelLarge),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: fieldFill,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: border(scheme.outline),
        enabledBorder: border(scheme.outline),
        focusedBorder: border(scheme.primary, 1.6),
        errorBorder: border(scheme.error),
        focusedErrorBorder: border(scheme.error, 1.6),
        hintStyle: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: scheme.outline),
        ),
      ),
      dividerTheme: DividerThemeData(color: scheme.outline, thickness: 1, space: 1),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surface,
        indicatorColor: scheme.primaryContainer,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => textTheme.labelSmall?.copyWith(
            letterSpacing: 0,
            color: s.contains(WidgetState.selected) ? scheme.primary : scheme.onSurfaceVariant,
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, shape: roundedMd),
    );
  }

  /// Noto Nastaliq Urdu for Urdu text. Nastaliq is tall, so lines get more room; Latin
  /// letters and digits (prices, codes) fall back to Inter.
  static TextTheme _urdu(TextTheme t) {
    final inter = GoogleFonts.inter().fontFamily!;
    TextStyle? u(TextStyle? s, double height) =>
        s?.copyWith(fontFamily: 'NotoNastaliqUrdu', fontFamilyFallback: [inter], height: height, letterSpacing: 0);
    return t.copyWith(
      displayLarge: u(t.displayLarge, 1.6),
      displayMedium: u(t.displayMedium, 1.6),
      displaySmall: u(t.displaySmall, 1.6),
      headlineLarge: u(t.headlineLarge, 1.6),
      headlineMedium: u(t.headlineMedium, 1.6),
      headlineSmall: u(t.headlineSmall, 1.7),
      titleLarge: u(t.titleLarge, 1.7),
      titleMedium: u(t.titleMedium, 1.7),
      titleSmall: u(t.titleSmall, 1.7),
      bodyLarge: u(t.bodyLarge, 1.9),
      bodyMedium: u(t.bodyMedium, 1.9),
      bodySmall: u(t.bodySmall, 1.8),
      labelLarge: u(t.labelLarge, 1.6),
      labelMedium: u(t.labelMedium, 1.6),
      labelSmall: u(t.labelSmall, 1.6),
    );
  }
}
