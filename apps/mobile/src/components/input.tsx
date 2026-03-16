import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { useColors } from "@/theme";

export function Input(props: TextInputProps) {
  const colors = useColors();

  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      {...props}
      style={[
        styles.input,
        {
          backgroundColor: colors.secondary,
          borderColor: colors.border,
          color: colors.foreground,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
  },
});
