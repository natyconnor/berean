import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeContext } from "@/lib/theme-context";
import { THEMES } from "@/lib/themes";
import { ThemeDropdown } from "./theme-dropdown";

function renderThemeMenu() {
  const theme = THEMES[0];
  if (!theme) throw new Error("Expected at least one theme");
  return render(
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: vi.fn(),
        darkMode: false,
        setDarkMode: vi.fn(),
      }}
    >
      <TooltipProvider delayDuration={0}>
        <ThemeDropdown />
      </TooltipProvider>
    </ThemeContext.Provider>,
  );
}

describe("ThemeDropdown", () => {
  it("names the icon trigger for the theme menu and matches its tooltip", async () => {
    const user = userEvent.setup();
    renderThemeMenu();

    const trigger = screen.getByRole("button", { name: "Change theme" });
    expect(trigger).toHaveAttribute("data-slot", "popover-trigger");

    await user.hover(trigger);
    expect(
      await screen.findByRole("tooltip", { name: "Change theme" }),
    ).toBeInTheDocument();
  });
});
