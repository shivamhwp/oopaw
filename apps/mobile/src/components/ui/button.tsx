import { Pressable, type PressableProps, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { useColors } from "@/constants/color";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary: "bg-accent",
  secondary: "bg-accentSoft",
  ghost: "bg-transparent",
  outline: "border border-line bg-card",
} as const;

const buttonSizes = {
  md: "min-h-12",
  sm: "min-h-10 px-3 py-2",
  icon: "size-12 px-0 py-0",
} as const;

const textVariants = {
  primary: "text-white",
  secondary: "text-accent",
  ghost: "text-ink",
  outline: "text-ink",
} as const;

type ButtonVariant = keyof typeof buttonVariants;
type ButtonSize = keyof typeof buttonSizes;

type ButtonProps = Omit<PressableProps, "children"> & {
  children?: React.ReactNode;
  className?: string;
  textClassName?: string;
  label?: string;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  children,
  className,
  disabled,
  label,
  loading,
  size = "md",
  textClassName,
  variant = "primary",
  ...props
}: ButtonProps) {
  const colors = useColors();

  return (
    <Pressable
      disabled={disabled || loading}
      className={cn(
        "flex-row items-center justify-center rounded-full px-4 py-3 active:opacity-90",
        buttonVariants[variant],
        buttonSizes[size],
        (disabled || loading) && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.primaryForeground : colors.primary}
        />
      ) : typeof children === "string" || label ? (
        <Text
          className={cn("text-center font-medium text-sm", textVariants[variant], textClassName)}
        >
          {children ?? label}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
