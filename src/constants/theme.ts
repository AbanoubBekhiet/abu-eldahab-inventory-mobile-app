/**
 * Stitch EcoMarket Design Tokens
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1F1B13',
    background: '#FFF8F1',
    surface: '#FFF8F1',
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#FBF2E5',
    surfaceContainer: '#F6EDE0',
    surfaceContainerHigh: '#F0E7DA',
    surfaceContainerHighest: '#EAE1D5',
    primary: '#2D3C1F',
    primaryContainer: '#435334',
    onPrimary: '#FFFFFF',
    secondary: '#51643C',
    secondaryContainer: '#D4EAB7',
    onSecondaryContainer: '#576A42',
    textSecondary: '#75786E',
    outline: '#75786E',
    outlineVariant: '#C5C8BC',
    border: '#EAE1D5',
    error: '#BA1A1A',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#93000A',
    backgroundElement: '#F6EDE0',
    backgroundSelected: '#D4EAB7',
  },
  dark: {
    text: '#F9F0E3',
    background: '#1F1B13',
    surface: '#2B261D',
    surfaceContainerLowest: '#1F1B13',
    surfaceContainerLow: '#28241C',
    surfaceContainer: '#343027',
    surfaceContainerHigh: '#3E392F',
    surfaceContainerHighest: '#4A453A',
    primary: '#BACDA5',
    primaryContainer: '#435334',
    onPrimary: '#111F06',
    secondary: '#B8CE9D',
    secondaryContainer: '#3A4C27',
    onSecondaryContainer: '#D4EAB7',
    textSecondary: '#C5C8BC',
    outline: '#75786E',
    outlineVariant: '#45483F',
    border: '#3E392F',
    error: '#FFB4AB',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',
    backgroundElement: '#343027',
    backgroundSelected: '#3A4C27',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'Manrope',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'Manrope, sans-serif',
    serif: 'serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 70 }) ?? 0;
export const MaxContentWidth = 800;

