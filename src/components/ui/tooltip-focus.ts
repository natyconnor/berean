let shouldOpenTooltipOnFocus = false;

/** True only after Tab, so restored or pointer focus does not pop a tooltip. */
export function tooltipOpensOnFocus(): boolean {
  return shouldOpenTooltipOnFocus;
}

export function setTooltipOpensOnFocus(value: boolean): void {
  shouldOpenTooltipOnFocus = value;
}
