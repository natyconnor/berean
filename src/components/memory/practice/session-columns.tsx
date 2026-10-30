import type { JSX, ReactNode } from "react";

import { ShowProgress } from "@/components/memory/show-progress";

/**
 * Session body with an optional side column, laid out like the verse boards:
 * the side column sits on the right from `md` up and above the content on
 * smaller screens. Refresh sittings put the card first on a phone and tuck
 * Progress / Verse behind Show progress.
 */
export function SessionColumns({
  aside,
  children,
  collapseAside = false,
}: {
  aside?: ReactNode;
  children: ReactNode;
  collapseAside?: boolean;
}): JSX.Element {
  if (!aside) return <>{children}</>;
  if (collapseAside) {
    return (
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="order-1 min-w-0">{children}</div>
        <div className="order-2">
          <ShowProgress>{aside}</ShowProgress>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="order-2 min-w-0 md:order-1">{children}</div>
      <div className="order-1 md:order-2">{aside}</div>
    </div>
  );
}
