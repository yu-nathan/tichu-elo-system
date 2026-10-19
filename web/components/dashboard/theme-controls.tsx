"use client";

import {
  Check,
  ChevronDown,
  Contrast,
  Eye,
  Palette,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { useSeasonalTheme } from "@/hooks/use-seasonal-theme";
import { SEASONAL_THEMES, THEME_LABELS } from "@/lib/seasonal-theme";

type ThemeState = ReturnType<typeof useSeasonalTheme>;

export const ThemeControls = ({
  season,
  canPreviewThemes = false,
}: {
  season: ThemeState;
  canPreviewThemes?: boolean;
}) => {
  const useDefault =
    season.preview !== null || season.preference === "automatic";
  const motionLabel = season.reducedMotion
    ? "Animations off: reduced motion enabled"
    : season.motionEnabled
      ? "Pause seasonal animations"
      : "Play seasonal animations";
  return (
    <>
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!season.initialized}
            render={<Button size="sm" variant="outline" />}
          >
            <Palette /> Appearance <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 max-w-[calc(100vw-2rem)]"
          >
            <DropdownMenuItem
              className="min-h-11"
              onClick={() =>
                season.selectPreference(useDefault ? "default" : "automatic")
              }
            >
              <Palette />{" "}
              {useDefault ? "Use default theme" : "Use seasonal theme"}
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem
              className="min-h-11"
              checked={season.colorBlindMode}
              onCheckedChange={season.toggleColorBlindMode}
            >
              <Contrast /> Color-blind mode
            </DropdownMenuCheckboxItem>
            {season.theme !== "default" ? (
              <DropdownMenuItem
                className="min-h-11"
                disabled={season.reducedMotion}
                onClick={season.toggleMotion}
              >
                {season.motionEnabled && !season.reducedMotion ? (
                  <Pause />
                ) : (
                  <Play />
                )}
                {motionLabel}
              </DropdownMenuItem>
            ) : null}
            {canPreviewThemes ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Preview themes</DropdownMenuLabel>
                  {SEASONAL_THEMES.map((theme) => (
                    <DropdownMenuItem
                      key={theme}
                      className="min-h-11"
                      onClick={() => season.selectPreview(theme)}
                    >
                      <span className="flex-1">{THEME_LABELS[theme]}</span>
                      {season.preview === theme ? (
                        <Check aria-label="Current preview" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                  {season.preview !== null ? (
                    <DropdownMenuItem
                      className="min-h-11"
                      onClick={() => season.selectPreference("automatic")}
                    >
                      Return to automatic
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="hidden sm:contents">
        {canPreviewThemes ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!season.initialized}
              render={<Button size="sm" variant="outline" />}
            >
              <Eye className="hidden sm:block" />
              Preview themes
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {SEASONAL_THEMES.map((theme) => (
                <DropdownMenuItem
                  key={theme}
                  onClick={() => season.selectPreview(theme)}
                >
                  {THEME_LABELS[theme]}
                </DropdownMenuItem>
              ))}
              {season.preview !== null ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => season.selectPreference("automatic")}
                  >
                    Return to automatic
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {season.theme !== "default" ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={motionLabel}
            title={motionLabel}
            disabled={season.reducedMotion}
            onClick={season.toggleMotion}
          >
            {season.motionEnabled && !season.reducedMotion ? (
              <Pause />
            ) : (
              <Play />
            )}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={season.colorBlindMode ? "secondary" : "outline"}
          aria-pressed={season.colorBlindMode}
          disabled={!season.initialized}
          onClick={season.toggleColorBlindMode}
          title="Use blue and amber interface accents with higher-contrast text"
        >
          {season.colorBlindMode ? <Check /> : <Contrast />}
          Color-blind mode
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!season.initialized}
          onClick={() =>
            season.selectPreference(useDefault ? "default" : "automatic")
          }
        >
          <Palette className="hidden sm:block" />
          {useDefault ? "Use default theme" : "Use seasonal theme"}
        </Button>
      </div>
    </>
  );
};
