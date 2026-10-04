// Design tokens — Emerald Fresh design system (light theme only).
// Fill values from the design system; keep every key. Build StyleSheets with
// makeStyles() and read useTheme().colors for color props.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#F4F7FB", // screen background
  onSurface: "#0F1E33", // main text
  surfaceSecondary: "#FFFFFF", // cards, sheets, rows
  onSurfaceSecondary: "#0F1E33",
  surfaceTertiary: "#EDF2F9", // inputs, chips
  onSurfaceTertiary: "#44566B",
  surfaceInverse: "#205396",
  onSurfaceInverse: "#FFFFFF",
  muted: "#8A9AAD", // muted/placeholder text

  // Brand — Ocean Blue (#205396)
  brand: "#205396",
  onBrand: "#FFFFFF",
  brandPrimary: "#205396",
  onBrandPrimary: "#FFFFFF",
  brandPrimaryPressed: "#1A4279",
  brandSecondary: "#2E6FB7",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E3EDF8", // primary light
  onBrandTertiary: "#205396",

  // Accent — Amber (#EF8D28)
  accent: "#EF8D28",
  onAccent: "#FFFFFF",

  // Convenience
  textSecondary: "#44566B",

  // Status
  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#EF8D28",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#205396",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E1E8F1",
  borderStrong: "#C5D1DE",
  divider: "#E1E8F1",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  x2l: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  x2l: 24,
  x3l: 30,
} as const;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
