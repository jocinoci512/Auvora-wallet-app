import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Aether Mist / Lagoon — mobile adaptation of the web design system.
abstract final class AetherColors {
  static const mist = Color(0xFFF4F6F8);
  static const mistDeep = Color(0xFFE8EEF2);
  static const ink = Color(0xFF12161C);
  static const muted = Color(0xFF5C6570);
  static const mutedOnDark = Color(0xFFA8B0BA);
  static const lagoon = Color(0xFF0E4F5C);
  static const lagoonDeep = Color(0xFF0B3A44);
  static const lagoonSoft = Color(0xFF3D9AAA);
  static const lagoonMist = Color(0xFFB7D7DD);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceDark = Color(0xFF1A1F27);
  static const danger = Color(0xFFB42318);
  static const success = Color(0xFF067647);
  static const warn = Color(0xFFB54708);
  static const border = Color(0xFFD8DEE6);
  static const borderDark = Color(0xFF2A323C);

  /// Brightness-aware secondary text for WCAG-friendly contrast.
  static Color mutedFor(BuildContext context) {
    return mutedForBrightness(Theme.of(context).brightness);
  }

  static Color mutedForBrightness(Brightness brightness) {
    return brightness == Brightness.dark ? mutedOnDark : muted;
  }

  static Color borderFor(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    return brightness == Brightness.dark ? borderDark : border;
  }

  static Color softLagoon(BuildContext context, {double alpha = 0.1}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return lagoonSoft.withValues(alpha: isDark ? alpha + 0.04 : alpha);
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
      : (isDark ? AetherColors.borderDark : AetherColors.border);
  final minTap = largeTouchTargets ? 56.0 : 52.0;
  final scaffold = isDark ? const Color(0xFF0F1318) : AetherColors.mist;
  final muted = AetherColors.mutedForBrightness(brightness);

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
    scaffoldBackgroundColor: scaffold,
    textTheme: body.copyWith(
      displayLarge: display.displayLarge?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -1.2,
        height: 1.05,
      ),
      displayMedium: display.displayMedium?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -1,
        height: 1.08,
      ),
      displaySmall: display.displaySmall?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.8,
        height: 1.1,
      ),
      headlineLarge: display.headlineLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.6),
      headlineMedium: display.headlineMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.4),
      titleLarge: display.titleLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.2),
      titleMedium: body.titleMedium?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.1),
      labelLarge: body.labelLarge?.copyWith(fontWeight: FontWeight.w600),
    ),
    appBarTheme: AppBarTheme(
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      backgroundColor: Colors.transparent,
      foregroundColor: colorScheme.onSurface,
      titleTextStyle: display.titleLarge?.copyWith(
        color: colorScheme.onSurface,
        fontWeight: FontWeight.w700,
        fontSize: 22,
        letterSpacing: -0.3,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 68,
      elevation: 0,
      backgroundColor: colorScheme.surface,
      indicatorColor: primary.withValues(alpha: isDark ? 0.22 : 0.12),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 12,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          letterSpacing: 0.1,
          color: selected ? primary : muted,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(size: 24, color: selected ? primary : muted);
      }),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: Size.fromHeight(minTap),
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        shadowColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16, letterSpacing: -0.1),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: Size.fromHeight(minTap),
        foregroundColor: primary,
        side: BorderSide(color: border, width: 1.2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: primary,
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    listTileTheme: ListTileThemeData(
      minVerticalPadding: largeTouchTargets ? 14 : 10,
      visualDensity: largeTouchTargets ? VisualDensity.comfortable : VisualDensity.standard,
      iconColor: primary,
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? const Color(0xFF232A33) : Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: primary, width: 1.5),
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
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: highContrast ? border : (isDark ? AetherColors.borderDark : AetherColors.border),
          width: highContrast ? 1.5 : 1,
        ),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colorScheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      showDragHandle: true,
      dragHandleColor: border,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      elevation: 0,
      backgroundColor: isDark ? const Color(0xFF232A33) : AetherColors.ink,
      contentTextStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    dividerColor: highContrast ? border : border.withValues(alpha: 0.7),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: primary,
      linearTrackColor: border.withValues(alpha: 0.5),
    ),
  );
}
