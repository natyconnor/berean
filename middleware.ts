import { next, rewrite } from "@vercel/functions";
import { resolveAppPath } from "./shared/http-routes";

/**
 * Runs before Vercel's filesystem and rewrites.
 * Known app routes are rewritten to the SPA shell (200).
 * Case and trailing-slash variants redirect to the canonical path (308).
 * Unknown paths fall through so `dist/404.html` is served with HTTP 404.
 * Files such as `/robots.txt` are left to the filesystem.
 */
export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  const decision = resolveAppPath(url.pathname, url.search);

  if (decision.type === "redirect") {
    url.pathname = decision.pathname;
    return Response.redirect(url, 308);
  }

  if (decision.type === "serve") {
    return rewrite(new URL("/index.html", request.url));
  }

  if (decision.type === "not-found") {
    return next({
      headers: { "X-Robots-Tag": "noindex" },
    });
  }

  return next();
}
