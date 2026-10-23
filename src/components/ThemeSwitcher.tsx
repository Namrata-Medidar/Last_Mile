// @ts-nocheck
import { useSyncExternalStore } from "react";
import { Monitor, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_THEME,
  THEME_OPTIONS,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from "@/lib/themes";

function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => DEFAULT_THEME);
  const selected = THEME_OPTIONS.find((option) => option.id === theme);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Change theme: ${selected.name}`}
          title={`Theme: ${selected.name}`}
          variant="ghost"
          size="icon"
          className="shrink-0 text-nav-foreground"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id} className="min-h-11 gap-3">
              {option.colors ? (
                <span
                  aria-hidden="true"
                  className="flex h-5 w-7 shrink-0 overflow-hidden rounded-sm border"
                  style={{ backgroundColor: option.colors.card, borderColor: option.colors.input }}
                >
                  <span className="w-1/2" style={{ backgroundColor: option.colors.primary }} />
                  <span className="w-1/2" style={{ backgroundColor: option.colors.background }} />
                </span>
              ) : (
                <Monitor aria-hidden="true" className="h-5 w-7 shrink-0" />
              )}
              {option.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ThemeSwitcher };
