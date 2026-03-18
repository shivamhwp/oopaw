import { useColorScheme } from "react-native";

export const THEME = {
  light: {
    background: "rgb(255, 255, 255)",
    foreground: "rgb(24, 24, 27)",
    card: "rgb(255, 255, 255)",
    cardForeground: "rgb(24, 24, 27)",
    primary: "rgb(91, 70, 255)",
    primaryForeground: "rgb(250, 250, 255)",
    secondary: "rgb(244, 244, 245)",
    secondaryForeground: "rgb(39, 39, 42)",
    muted: "rgb(244, 244, 245)",
    mutedForeground: "rgb(113, 113, 122)",
    accent: "rgb(240, 235, 255)",
    accentForeground: "rgb(76, 29, 149)",
    destructive: "rgb(220, 38, 38)",
    destructiveForeground: "rgb(254, 242, 242)",
    border: "rgb(228, 228, 231)",
    input: "rgb(228, 228, 231)",
    ring: "rgb(167, 139, 250)",
  },
  dark: {
    background: "rgb(10, 10, 10)",
    foreground: "rgb(250, 250, 250)",
    card: "rgb(17, 17, 19)",
    cardForeground: "rgb(250, 250, 250)",
    primary: "rgb(196, 181, 253)",
    primaryForeground: "rgb(34, 25, 68)",
    secondary: "rgb(39, 39, 42)",
    secondaryForeground: "rgb(250, 250, 250)",
    muted: "rgb(39, 39, 42)",
    mutedForeground: "rgb(161, 161, 170)",
    accent: "rgb(49, 46, 129)",
    accentForeground: "rgb(238, 242, 255)",
    destructive: "rgb(248, 113, 113)",
    destructiveForeground: "rgb(69, 10, 10)",
    border: "rgb(39, 39, 42)",
    input: "rgb(39, 39, 42)",
    ring: "rgb(165, 180, 252)",
  },
} as const;

export type ThemeColors = { [K in keyof (typeof THEME)["light"]]: string };

export const useColors = () => THEME[useColorScheme() === "dark" ? "dark" : "light"];
