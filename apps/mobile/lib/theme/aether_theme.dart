import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Aether Mist / Lagoon — mobile adaptation of the web design system.
abstract final class AetherColors {
  static const mist = Color(0xFFF4F6F8);
  static const ink = Color(0xFF12161C);
  static const muted = Color(0xFF5C6570);
  static const lagoon = Color(0xFF0E4F5C);
  static const lagoonSoft = Color(0xFF3D9AAA);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceDark = Color(0xFF1A1F27);
  static const danger = Color(0xFFB42318);
  static const border = Color(0xFFD8DEE6);
}

ThemeData buildAetherTheme({required Brightness brightness}) {
  final isDark = brightness == Brightness.dark;
  final base = isDark ? ThemeData.dark(useMaterial3: true) : ThemeData.light(useMaterial3: true);
  final display = GoogleFonts.syneTextTheme(base.textTheme);
  final body = GoogleFonts.manropeTextTheme(base.textTheme);

  final colorScheme = ColorScheme(
    brightness: brightness,
    primary: AetherColors.lagoon,
    onPrimary: Colors.white,
    secondary: AetherColors.lagoonSoft,
    onSecondary: Colors.white,
    error: AetherColors.danger,
    onError: Colors.white,
    surface: isDark ? AetherColors.surfaceDark : AetherColors.surface,
    onSurface: isDark ? const Color(0xFFF2F4F7) : AetherColors.ink,
  );

  return base.copyWith(
    colorScheme: colorScheme,
    scaffoldBackgroundColor: isDark ? const Color(0xFF0F1318) : AetherColors.mist,
    textTheme: body.copyWith(
      displayLarge: display.displayLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -1),
      displayMedium: display.displayMedium?.copyWith(fontWeight: FontWeight.w700),
      headlineLarge: display.headlineLarge?.copyWith(fontWeight: FontWeight.w700),
      headlineMedium: display.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
      titleLarge: display.titleLarge?.copyWith(fontWeight: FontWeight.w700),
    ),
    appBarTheme: AppBarTheme(
      elevation: 0,
      centerTitle: false,
      backgroundColor: Colors.transparent,
      foregroundColor: colorScheme.onSurface,
      titleTextStyle: display.titleLarge?.copyWith(
        color: colorScheme.onSurface,
        fontWeight: FontWeight.w700,
        fontSize: 22,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        backgroundColor: AetherColors.lagoon,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        foregroundColor: AetherColors.lagoon,
        side: const BorderSide(color: AetherColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? const Color(0xFF232A33) : Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AetherColors.border),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: isDark ? AetherColors.surfaceDark : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: isDark ? const Color(0xFF2A323C) : AetherColors.border),
      ),
    ),
  );
}
