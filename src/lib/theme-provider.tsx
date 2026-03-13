import { useState, useEffect, useCallback, type ReactNode } from "react";
import { warmManuscriptTheme } from "@/components/theme-test/theme-warm-manuscript";
import { THEMES } from "@/lib/themes";
import { ThemeContext } from "@/lib/theme-context";
import type { AppTheme } from "@/components/theme-test/theme-types";

const THEME_STORAGE_KEY = "bible-notes-theme";
const DARK_MODE_STORAGE_KEY = "bible-notes-dark-mode";

function resolveInitialTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      const match = THEMES.find((t) => t.name === saved);
      if (match) return match;
    }
  } catch {
    // localStorage unavailable
  }
  return warmManuscriptTheme;
}

function resolveInitialDarkMode(): boolean {
  try {
    const saved = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (saved !== null) return saved === "true";
  } catch {
    // localStorage unavailable
  }
  return false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(resolveInitialTheme);
  const [darkMode, setDarkModeState] = useState<boolean>(
    resolveInitialDarkMode,
  );

  // Apply CSS vars and Tailwind dark class to :root whenever theme or dark mode changes
  useEffect(() => {
    const root = document.documentElement;
    const vars = darkMode ? theme.darkVars : theme.vars;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    root.classList.toggle("dark", darkMode);
  }, [theme, darkMode]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next.name);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const setDarkMode = useCallback((dark: boolean) => {
    setDarkModeState(dark);
    try {
      localStorage.setItem(DARK_MODE_STORAGE_KEY, String(dark));
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
