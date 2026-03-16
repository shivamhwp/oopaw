import { useColorScheme } from "react-native";
import { THEME } from "@/lib/theme";

const LIGHT_COLORS = THEME.light;
const DARK_COLORS = THEME.dark;
const COLORS = {
  white: "rgb(255, 255, 255)",
  black: "rgb(0, 0, 0)",
  light: LIGHT_COLORS,
  dark: DARK_COLORS,
} as const;

const IOS_SYSTEM_COLORS = COLORS;
const ANDROID_COLORS = COLORS;
const WEB_COLORS = COLORS;
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
