import type { AppTheme } from "./theme-types";
import { MockUI } from "./mock-ui";

interface ThemePreviewPanelProps {
  theme: AppTheme;
}

export function ThemePreviewPanel({ theme }: ThemePreviewPanelProps) {
  const cssVars = Object.entries(theme.vars).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-col min-w-0 flex-1">
      {/* Theme label */}
      <div
        className="shrink-0 px-4 py-3 border-b"
        style={{
          backgroundColor: theme.vars["--background"],
          borderColor: theme.vars["--border"],
        }}
      >
        <h2
          className="font-semibold text-base"
          style={{ color: theme.vars["--foreground"] }}
        >
          {theme.name}
        </h2>
        <p
          className="text-xs mt-0.5"
          style={{ color: theme.vars["--muted-foreground"] }}
        >
          {theme.description}
        </p>
        {/* Primary color swatch row */}
        <div className="flex items-center gap-2 mt-2">
          {[
            {
              label: "Primary",
              bg: theme.vars["--primary"],
              fg: theme.vars["--primary-foreground"],
            },
            {
              label: "Secondary",
              bg: theme.vars["--secondary"],
              fg: theme.vars["--secondary-foreground"],
            },
            {
              label: "Accent",
              bg: theme.vars["--accent"],
              fg: theme.vars["--accent-foreground"],
            },
            {
              label: "Muted",
              bg: theme.vars["--muted"],
              fg: theme.vars["--muted-foreground"],
            },
          ].map(({ label, bg }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <div
                className="h-5 w-10 rounded shadow-sm border"
                style={{
                  backgroundColor: bg,
                  borderColor: theme.vars["--border"],
                }}
              />
              <span
                className="text-[10px]"
                style={{ color: theme.vars["--muted-foreground"] }}
              >
                {label}
              </span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-0.5">
            <div
              className="h-5 w-10 rounded shadow-sm border"
              style={{
                backgroundColor: theme.vars["--background"],
                borderColor: theme.vars["--border"],
              }}
            />
            <span
              className="text-[10px]"
              style={{ color: theme.vars["--muted-foreground"] }}
            >
              Background
            </span>
          </div>
        </div>
      </div>

      {/* Preview area */}
      <div
        className="flex-1 overflow-hidden"
        style={cssVars as React.CSSProperties}
      >
        <MockUI />
      </div>
    </div>
  );
}
