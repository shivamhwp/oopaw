import { TextInput, type TextInputProps } from "react-native";
import { useColors } from "@/constants/color";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: TextInputProps & { className?: string }) {
  const colors = useColors();

  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      className={cn(
        "min-h-12 rounded-[22px] border border-line bg-card px-4 py-3 text-ink",
        className,
      )}
      {...props}
    />
  );
}
