import type { CSSProperties } from "react";

/** Must stay in sync with `index.html` #splash-bg inner layers (pre-JS splash). */
export const HERO_IMAGE_PATH = "/berean-hero.webp";

/** Slight zoom so `background-size: cover` never shows subpixel gaps at viewport edges. */
export const heroBackdropScaleStyle: Pick<CSSProperties, "scale"> = {
  scale: "1.03",
};

export function heroBackgroundLayerStyle(
  extra?: CSSProperties,
): CSSProperties {
  return {
    backgroundImage: `url(${HERO_IMAGE_PATH})`,
    ...heroBackdropScaleStyle,
    ...extra,
  };
}

export function heroGradientOverlayLayerStyle(
  extra?: CSSProperties,
): CSSProperties {
  return { ...heroBackdropScaleStyle, ...extra };
}
