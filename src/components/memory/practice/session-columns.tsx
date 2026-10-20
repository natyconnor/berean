import type { JSX, ReactNode } from "react";

/**
 * Session body with an optional side column, laid out like the verse boards:
 * the side column sits on the right from `md` up and above the content on
 * smaller screens.
 */
export function SessionColumns({
  aside,
  children,
}: {
  aside?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  if (!aside) return <>{children}</>;
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="order-2 min-w-0 md:order-1">{children}</div>
      <div className="order-1 md:order-2">{aside}</div>
    </div>
  );
}
