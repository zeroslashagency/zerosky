import 'package:flutter/material.dart';

/// Zerosky theme: mirrors packages/ui/src/styles/theme.css design tokens.
/// Supports both light and dark modes with an Apple-like aesthetic:
/// restrained, minimal, high contrast, generous spacing, subtle borders,
/// small radii, no gradients.
class AppTheme {
  // Light mode colors
  static const _lightBackground = Color(0xFFFFFFFF); // hsl(0 0% 100%)
  static const _lightForeground = Color(0xFF09090B); // hsl(222.2 84% 4.9%)
  static const _lightPrimary = Color(0xFF2563EB); // hsl(221.2 83.2% 53.3%)
  static const _lightPrimaryForeground = Color(0xFFF8FAFC); // hsl(210 40% 98%)
  static const _lightBorder = Color(0xFF94A3B8); // hsl(214.3 31.8% 60%)
  static const _lightMuted = Color(0xFFF1F5F9); // hsl(210 40% 96%)
  static const _lightMutedForeground = Color(0xFF64748B); // hsl(215.4 16.3% 46.9%)
  static const _lightDestructive = Color(0xFFEF4444); // hsl(0 84.2% 60.2%)

  // Dark mode colors
  static const _darkBackground = Color(0xFF09090B); // hsl(222.2 84% 4.9%)
  static const _darkForeground = Color(0xFFF8FAFC); // hsl(210 40% 98%)
  static const _darkPrimary = Color(0xFF3B82F6); // hsl(217.2 91.2% 59.8%)
  static const _darkPrimaryForeground = Color(0xFF1E293B); // hsl(222.2 47% 11.2%)
  static const _darkBorder = Color(0xFF475569); // hsl(217.2 32.6% 42%)
  static const _darkMuted = Color(0xFF1E293B); // hsl(217.2 32.6% 17.5%)
  static const _darkMutedForeground = Color(0xFF94A3B8); // hsl(215 20.2% 65.1%)
  static const _darkDestructive = Color(0xFFB91C1C); // hsl(0 62.8% 30.6%)

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.light(
        primary: _lightPrimary,
        onPrimary: _lightPrimaryForeground,
        secondary: _lightMuted,
        onSecondary: _lightForeground,
        surface: _lightBackground,
        onSurface: _lightForeground,
        error: _lightDestructive,
        onError: _lightPrimaryForeground,
        outline: _lightBorder,
      ),
      scaffoldBackgroundColor: _lightBackground,
      cardTheme: CardThemeData(
        color: _lightBackground,
        elevation: 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: _lightBorder.withValues(alpha: 0.2)),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: _lightBackground,
        foregroundColor: _lightForeground,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: _lightForeground,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: _lightBackground,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: _lightBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: _lightBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: _lightPrimary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: _lightDestructive),
        ),
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _lightPrimary,
          foregroundColor: _lightPrimaryForeground,
          elevation: 0,
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: _lightPrimary,
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: _lightBorder.withValues(alpha: 0.3),
        thickness: 1,
        space: 1,
      ),
      textTheme: TextTheme(
        displayLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: _lightForeground,
        ),
        displayMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w600,
          color: _lightForeground,
        ),
        displaySmall: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w600,
          color: _lightForeground,
        ),
        headlineMedium: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: _lightForeground,
        ),
        headlineSmall: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: _lightForeground,
        ),
        titleLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: _lightForeground,
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: _lightForeground,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: _lightForeground,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: _lightMutedForeground,
        ),
        labelLarge: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: _lightForeground,
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        primary: _darkPrimary,
        onPrimary: _darkPrimaryForeground,
        secondary: _darkMuted,
        onSecondary: _darkForeground,
        surface: _darkBackground,
        onSurface: _darkForeground,
        error: _darkDestructive,
        onError: _darkForeground,
        outline: _darkBorder,
      ),
      scaffoldBackgroundColor: _darkBackground,
      cardTheme: CardThemeData(
        color: _darkMuted,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: _darkBorder.withValues(alpha: 0.2)),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: _darkBackground,
        foregroundColor: _darkForeground,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: _darkForeground,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: _darkMuted,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: _darkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: _darkBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: _darkPrimary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: _darkDestructive),
        ),
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _darkPrimary,
          foregroundColor: _darkBackground,
          elevation: 0,
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: _darkPrimary,
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: _darkBorder.withValues(alpha: 0.3),
        thickness: 1,
        space: 1,
      ),
      textTheme: TextTheme(
        displayLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: _darkForeground,
        ),
        displayMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w600,
          color: _darkForeground,
        ),
        displaySmall: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w600,
          color: _darkForeground,
        ),
        headlineMedium: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: _darkForeground,
        ),
        headlineSmall: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: _darkForeground,
        ),
        titleLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: _darkForeground,
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: _darkForeground,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: _darkForeground,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: _darkMutedForeground,
        ),
        labelLarge: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: _darkForeground,
        ),
      ),
    );
  }
}
