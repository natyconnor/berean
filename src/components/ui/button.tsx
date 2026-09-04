import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";
import { buttonVariants } from "./button-variants";

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Disables the button and shows a spinner in place of leading icons. */
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      data-loading={loading ? true : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? (
            <Loader2 data-icon="spinner" className="animate-spin" aria-hidden />
          ) : null}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button };
