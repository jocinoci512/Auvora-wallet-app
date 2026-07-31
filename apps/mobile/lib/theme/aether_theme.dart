import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Aether Mist / Lagoon — mobile adaptation of the web design system.
abstract final class AetherColors {
  static const mist = Color(0xFFF4F6F8);
  static const ink = Color(0xFF12161C);
  static const muted = Color(0xFF5C6570);
  static const mutedOnDark = Color(0xFFA8B0BA);
  static const lagoon = Color(0xFF0E4F5C);
  static const lagoonSoft = Color(0xFF3D9AAA);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceDark = Color(0xFF1A1F27);
  static const danger = Color(0xFFB42318);
  static const border = Color(0xFFD8DEE6);

  /// Brightness-aware secondary text for WCAG-friendly contrast.
  static Color mutedFor(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    return brightness == Brightness.dark ? mutedOnDark : muted;
  }
}

ThemeData buildAetherTheme({
  required Brightness brightness,
  bool highContrast = false,
  bool largeTouchTargets = false,
  Color? accentColor,
}) {
  final isDark = brightness == Brightness.dark;
  final base = isDark ? ThemeData.dark(useMaterial3: true) : ThemeData.light(useMaterial3: true);
  final display = GoogleFonts.syneTextTheme(base.textTheme);
  final body = GoogleFonts.manropeTextTheme(base.textTheme);
  final primary = accentColor ?? AetherColors.lagoon;
  final onSurface = highContrast
      ? (isDark ? Colors.white : Colors.black)
      : (isDark ? const Color(0xFFF2F4F7) : AetherColors.ink);
  final border = highContrast
      ? (isDark ? Colors.white70 : Colors.black54)
      : AetherColors.border;
  final minTap = largeTouchTargets ? 56.0 : 52.0;

  final colorScheme = ColorScheme(
    brightness: brightness,
    primary: primary,
    onPrimary: Colors.white,
    secondary: AetherColors.lagoonSoft,
    onSecondary: Colors.white,
    error: AetherColors.danger,
    onError: Colors.white,
    surface: isDark ? AetherColors.surfaceDark : AetherColors.surface,
    onSurface: onSurface,
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
        minimumSize: Size.fromHeight(minTap),
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: Size.fromHeight(minTap),
        foregroundColor: primary,
        side: BorderSide(color: border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    listTileTheme: ListTileThemeData(
      minVerticalPadding: largeTouchTargets ? 14 : 8,
      visualDensity: largeTouchTargets ? VisualDensity.comfortable : VisualDensity.standard,
    ),
    switchTheme: SwitchThemeData(
      materialTapTargetSize:
          largeTouchTargets ? MaterialTapTargetSize.padded : MaterialTapTargetSize.shrinkWrap,
    ),
    chipTheme: base.chipTheme.copyWith(
      padding: EdgeInsets.symmetric(
        horizontal: largeTouchTargets ? 14 : 10,
        vertical: largeTouchTargets ? 10 : 8,
      ),
      labelPadding: const EdgeInsets.symmetric(horizontal: 4),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? const Color(0xFF232A33) : Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: border),
      ),
      contentPadding: EdgeInsets.symmetric(
        horizontal: 16,
        vertical: largeTouchTargets ? 18 : 16,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: isDark ? AetherColors.surfaceDark : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: highContrast
              ? border
              : (isDark ? const Color(0xFF2A323C) : AetherColors.border),
          width: highContrast ? 1.5 : 1,
        ),
      ),
    ),
    dividerColor: highContrast ? border : null,
  );
}
