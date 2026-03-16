import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { useColors, type ThemeColors } from "@/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";

type ButtonProps = PressableProps & {
  variant?: ButtonVariant;
  label?: string;
  loading?: boolean;
  children?: React.ReactNode;
};

const variantStyles = (c: ThemeColors) => ({
  primary: { bg: c.primary, text: c.primaryForeground, border: c.primary },
  secondary: { bg: c.secondary, text: c.secondaryForeground, border: c.secondary },
  ghost: { bg: "transparent", text: c.foreground, border: "transparent" },
  outline: { bg: "transparent", text: c.foreground, border: c.border },
});

export function Button({
  variant = "primary",
  label,
  loading,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const colors = useColors();
  const v = variantStyles(colors)[variant];

  return (
    <Pressable
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.5 : 1,
        },
        style as object,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : children ? (
        children
      ) : label ? (
        <Text style={[styles.label, { color: v.text }]}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 20,
    height: 48,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
});
