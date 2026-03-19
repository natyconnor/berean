import { Palette, Check, Sun, Moon } from "lucide-react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme } from "@/lib/use-theme";
import { THEMES } from "@/lib/themes";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeDropdown() {
  const { theme, setTheme, darkMode, setDarkMode } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TooltipButton
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          tooltip="Change theme"
        >
          <Palette className="h-4 w-4" />
        </TooltipButton>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-56 p-1.5" data-passage-dismiss-exempt>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2 pt-1 pb-1.5">
          Theme
        </p>
        <div className="space-y-0.5">
          {THEMES.map((t) => {
            const isActive = t.name === theme.name;
            const swatchVars = darkMode ? t.darkVars : t.vars;
            return (
              <button
                key={t.name}
                className={cn(
                  "w-full flex items-start gap-3 px-2 py-2 rounded-md text-left transition-colors cursor-pointer",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted",
                )}
                onClick={() => {
                  setTheme(t);
                  setOpen(false);
                }}
              >
                <div className="flex gap-0.5 mt-0.5 shrink-0">
                  {[
                    swatchVars["--primary"],
                    swatchVars["--secondary"],
                    swatchVars["--background"],
                  ].map((color, i) => (
                    <div
                      key={i}
                      className="h-3.5 w-3.5 rounded-sm border border-black/10"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium leading-none">
                      {t.name}
                    </span>
                    {isActive && (
                      <Check className="h-3 w-3 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                    {t.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-1 pt-1.5 border-t border-border">
          <button
            className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-muted transition-colors cursor-pointer"
            onClick={() => setDarkMode(!darkMode)}
          >
            <div className="flex items-center gap-2">
              {darkMode ? (
                <Moon className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Dark mode</span>
            </div>
            <div
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                darkMode ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                  darkMode ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </div>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
