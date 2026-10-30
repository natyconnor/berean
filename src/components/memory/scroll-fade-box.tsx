import type { ComponentProps, JSX } from "react";

import { useScrollFade } from "@/hooks/use-scroll-fade";
import { cn } from "@/lib/utils";

export function ScrollFadeBox({
  name,
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  name?: "how-you-did" | "full-text" | "hint" | "answer";
}): JSX.Element {
  const { ref, tabIndex, fade } = useScrollFade();
  return (
    <div className="relative">
      <div
        ref={ref}
        tabIndex={tabIndex}
        data-result-scroll={name}
        className={cn(
          "overflow-y-auto [scrollbar-width:thin] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className,
        )}
        {...props}
      >
        {children}
      </div>
      {fade ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent"
        />
      ) : null}
    </div>
  );
}
