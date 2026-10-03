import 'package:flutter/material.dart';

/// Brand palette. Source of truth: docs/design-tokens.md
abstract final class AppColors {
  // Client palette
  static const maroon900 = Color(0xFF420000);
  static const neutral50 = Color(0xFFF6F6F6);
  static const neutral100 = Color(0xFFEAE9E9);
  static const neutral200 = Color(0xFFD4D7DD);

  // Derived maroon shades
  static const maroon950 = Color(0xFF2A0000);
  static const maroon700 = Color(0xFF6B1A1A);
  static const maroon500 = Color(0xFF9B3B3B);
  static const maroon100 = Color(0xFFF2E4E4);

  static const white = Color(0xFFFFFFFF);
  static const ink = Color(0xFF2A1616);
  static const muted = Color(0xFF5E626B);

  // Status (meaning only)
  static const success = Color(0xFF1E7A4F);
  static const warning = Color(0xFFA15C00);
  static const danger = Color(0xFFC62828);
  static const info = Color(0xFF2F5BD3);

  // Dark theme
  static const darkBackground = Color(0xFF140606);
  static const darkSurface = Color(0xFF221010);
  static const darkSurface2 = Color(0xFF311818);
  static const darkBorder = Color(0xFF4A2423);
  static const darkText = Color(0xFFF6F6F6);
  static const darkMuted = Color(0xFFBBAEAE);
  static const darkPrimary = Color(0xFFE8A7A0);
}
