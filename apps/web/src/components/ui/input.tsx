import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "flex w-full rounded-lg border border-border/80 bg-background px-3 py-2.5 text-sm text-foreground transition placeholder:text-muted-foreground/55 disabled:pointer-events-none disabled:opacity-50 outline-none ring-0 focus:ring-0 focus-visible:ring-0 md:py-2 md:text-xs",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export { Input };
