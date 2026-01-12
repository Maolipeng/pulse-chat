import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const background = Color(0xFFF2F6FA);
  static const surface = Color(0xFFF6FAFD);
  static const accent = Color(0xFF5EC7D9);
  static const accentDark = Color(0xFF4BB5C7);
  static const textMain = Color(0xFF4A5363);
  static const textMuted = Color(0xFF98A3B3);

  static ThemeData buildTheme() {
    final base = ThemeData.light();
    final textTheme = GoogleFonts.montserratTextTheme(base.textTheme)
        .apply(bodyColor: textMain, displayColor: textMain);

    return base.copyWith(
      scaffoldBackgroundColor: background,
      colorScheme: const ColorScheme.light(
        primary: accent,
        secondary: Color(0xFF78D3E1),
        surface: surface,
      ),
      textTheme: textTheme,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        hintStyle: textTheme.bodySmall?.copyWith(color: textMuted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: const BorderSide(color: accent),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      ),
    );
  }
}
