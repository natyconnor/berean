import type { ComponentProps, MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * An in-app link to a built href (path plus search), navigated client-side.
 * Modified clicks keep the browser's default so links still open in new tabs.
 */
export function InternalLink({
  href,
  onClick,
  ...props
}: ComponentProps<"a"> & { href: string }) {
  const navigate = useNavigate();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (props.target !== undefined && props.target !== "_self")
    ) {
      return;
    }
    event.preventDefault();
    void navigate({ href });
  };

  return <a {...props} href={href} onClick={handleClick} />;
}
