import { Pressable, type PressableProps, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { useColors } from "@/constants/color";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  ghost: "bg-transparent",
  outline: "border border-line bg-card",
} as const;

const buttonSizes = {
  md: "min-h-12 px-4 py-3",
  sm: "min-h-10 px-3 py-2.5",
  icon: "size-11 px-0 py-0",
} as const;

const textVariants = {
  primary: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-foreground",
  outline: "text-foreground",
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
        "flex-row items-center justify-center rounded-[18px] active:opacity-90",
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
          className={cn("text-center text-sm font-semibold", textVariants[variant], textClassName)}
        >
          {children ?? label}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
