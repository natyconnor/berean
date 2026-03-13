import { useContext } from "react";
import { ThemeContext, type ThemeContextValue } from "@/lib/theme-context";

export type { ThemeContextValue };

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
