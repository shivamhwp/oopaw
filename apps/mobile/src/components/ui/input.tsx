import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor="#8a7b6a"
      className={cn(
        "min-h-12 rounded-[22px] border border-line bg-white px-4 py-3 text-ink",
        className,
      )}
      {...props}
    />
  );
}
