import type { ComponentProps, JSX } from "react";

import { ScrollFadeBox } from "@/components/memory/scroll-fade-box";

export function OverflowRegion({
  name,
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  name: "how-you-did" | "full-text";
}): JSX.Element {
  return (
    <ScrollFadeBox name={name} className={className} {...props}>
      {children}
    </ScrollFadeBox>
  );
}
