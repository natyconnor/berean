import { createContext } from "react";
import type { AppTheme } from "@/themes/theme-types";

export interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
