import { ThemePreviewPanel } from "./theme-preview-panel";
import { warmManuscriptTheme } from "@/themes/theme-warm-manuscript";
import { deepIndigoTheme } from "@/themes/theme-deep-indigo";
import { forestSageTheme } from "@/themes/theme-forest-sage";

export function ThemeTestPage() {
  const themes = [warmManuscriptTheme, deepIndigoTheme, forestSageTheme];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="shrink-0 border-b px-5 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-base">Theme Test</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comparing {themes.length} candidate themes side-by-side
          </p>
        </div>
        <a
          href="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          ← Back to app
        </a>
      </div>

      <div className="flex flex-1 overflow-hidden divide-x divide-border">
        {themes.map((theme) => (
          <ThemePreviewPanel key={theme.name} theme={theme} />
        ))}
      </div>
    </div>
  );
}
