import { cva, type VariantProps } from "class-variance-authority";
import { Pressable, type PressableProps, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "flex-row items-center justify-center rounded-full px-4 py-3 active:opacity-90",
  {
    variants: {
      variant: {
        primary: "bg-accent",
        secondary: "bg-accentSoft",
        ghost: "bg-transparent",
        outline: "border border-line bg-card",
      },
      size: {
        md: "min-h-12",
        sm: "min-h-10 px-3 py-2",
        icon: "size-12 px-0 py-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

const textStyles = cva("text-center font-medium", {
  variants: {
    variant: {
      primary: "text-white",
      secondary: "text-accent",
      ghost: "text-ink",
      outline: "text-ink",
    },
    size: {
      md: "text-sm",
      sm: "text-sm",
      icon: "text-sm",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

type ButtonProps = Omit<PressableProps, "children"> &
  VariantProps<typeof buttonStyles> & {
    children?: React.ReactNode;
    className?: string;
    textClassName?: string;
    label?: string;
    loading?: boolean;
  };

export function Button({
  children,
  className,
  disabled,
  label,
  loading,
  size,
  textClassName,
  variant,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled || loading}
      className={cn(
        buttonStyles({ size, variant }),
        (disabled || loading) && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#ffffff" : "#0c7a5a"} />
      ) : typeof children === "string" || label ? (
        <Text className={cn(textStyles({ size, variant }), textClassName)}>
          {children ?? label}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
