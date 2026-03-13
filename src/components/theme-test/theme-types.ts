export interface ThemeVars {
  "--background": string;
  "--foreground": string;
  "--card": string;
  "--card-foreground": string;
  "--popover": string;
  "--popover-foreground": string;
  "--primary": string;
  "--primary-foreground": string;
  "--secondary": string;
  "--secondary-foreground": string;
  "--muted": string;
  "--muted-foreground": string;
  "--accent": string;
  "--accent-foreground": string;
  "--destructive": string;
  "--border": string;
  "--input": string;
  "--ring": string;
  "--radius": string;
}

export interface AppTheme {
  name: string;
  description: string;
  vars: ThemeVars;
  darkVars: ThemeVars;
}
