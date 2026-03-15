import { Platform, useColorScheme } from "react-native";

const LIGHT_COLORS = {
  grey6: "rgb(249, 249, 249)",
  grey5: "rgb(239, 239, 239)",
  grey4: "rgb(216, 216, 216)",
  grey3: "rgb(232, 232, 232)",
  grey2: "rgb(231, 183, 228)",
  grey: "rgb(100, 100, 100)",
  background: "rgb(249, 249, 249)",
  foreground: "rgb(32, 32, 32)",
  root: "rgb(249, 249, 249)",
  card: "rgb(252, 252, 252)",
  popover: "rgb(252, 252, 252)",
  primary: "rgb(82, 69, 86)",
  primaryForeground: "rgb(255, 255, 255)",
  secondary: "rgb(231, 183, 228)",
  secondaryForeground: "rgb(64, 42, 70)",
  muted: "rgb(239, 239, 239)",
  mutedForeground: "rgb(100, 100, 100)",
  accent: "rgb(232, 232, 232)",
  accentForeground: "rgb(32, 32, 32)",
  destructive: "rgb(147, 82, 179)",
  destructiveForeground: "rgb(255, 255, 255)",
  border: "rgb(216, 216, 216)",
  input: "rgb(216, 216, 216)",
  ring: "rgb(82, 69, 86)",
} as const;

const DARK_COLORS = {
  grey6: "rgb(14, 14, 14)",
  grey5: "rgb(25, 25, 25)",
  grey4: "rgb(28, 25, 27)",
  grey3: "rgb(42, 42, 42)",
  grey2: "rgb(50, 42, 50)",
  grey: "rgb(180, 180, 180)",
  background: "rgb(14, 14, 14)",
  foreground: "rgb(238, 238, 238)",
  root: "rgb(14, 14, 14)",
  card: "rgb(25, 25, 25)",
  popover: "rgb(25, 25, 25)",
  primary: "rgb(233, 192, 234)",
  primaryForeground: "rgb(25, 32, 19)",
  secondary: "rgb(50, 42, 50)",
  secondaryForeground: "rgb(233, 192, 234)",
  muted: "rgb(32, 32, 32)",
  mutedForeground: "rgb(180, 180, 180)",
  accent: "rgb(42, 42, 42)",
  accentForeground: "rgb(238, 238, 238)",
  destructive: "rgb(186, 38, 38)",
  destructiveForeground: "rgb(255, 255, 255)",
  border: "rgb(28, 25, 27)",
  input: "rgb(72, 72, 72)",
  ring: "rgb(233, 192, 234)",
} as const;

const createPlatformColors = () =>
  ({
    white: "rgb(255, 255, 255)",
    black: "rgb(0, 0, 0)",
    light: LIGHT_COLORS,
    dark: DARK_COLORS,
  }) as const;

const IOS_SYSTEM_COLORS = createPlatformColors();
const ANDROID_COLORS = createPlatformColors();
const WEB_COLORS = createPlatformColors();

const COLORS =
  Platform.OS === "ios"
    ? IOS_SYSTEM_COLORS
    : Platform.OS === "android"
      ? ANDROID_COLORS
      : WEB_COLORS;

const useColors = () => COLORS[useColorScheme() === "dark" ? "dark" : "light"];

export {
  ANDROID_COLORS,
  COLORS,
  IOS_SYSTEM_COLORS,
  LIGHT_COLORS,
  DARK_COLORS,
  WEB_COLORS,
  useColors,
};
