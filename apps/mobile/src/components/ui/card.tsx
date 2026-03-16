import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn("rounded-[24px] border border-line bg-card px-4 py-4 shadow-sm", className)}
      {...props}
    />
  );
}
