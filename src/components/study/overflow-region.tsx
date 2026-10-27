import type { ComponentProps, JSX } from "react";

import { useOverflowTabIndex } from "@/hooks/use-overflow-tab-index";
import { cn } from "@/lib/utils";

export function OverflowRegion({
  name,
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  name: "how-you-did" | "full-text";
}): JSX.Element {
  const { ref, tabIndex } = useOverflowTabIndex();
  return (
    <div
      ref={ref}
      tabIndex={tabIndex}
      data-result-scroll={name}
      className={cn(
        "overflow-y-auto outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
