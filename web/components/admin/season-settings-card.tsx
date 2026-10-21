"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCurrentSeason,
  seasonDateLabel,
  SEASON_CADENCES,
  type Season,
  type SeasonCadence,
  type SeasonSettings,
} from "@/lib/seasons";

export const SeasonSettingsCard = ({
  settings,
  season,
  busy,
  onSave,
  onRefresh,
}: {
  settings: SeasonSettings;
  season: Season;
  busy: boolean;
  onSave: (settings: SeasonSettings) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}) => {
  const [cadence, setCadence] = useState<SeasonCadence>(settings.cadenceMonths);
  const [status, setStatus] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(
    () => setCadence(settings.cadenceMonths),
    [settings.cadenceMonths, settings.revision],
  );
  const changed = cadence !== settings.cadenceMonths;
  const preview = changed ? getCurrentSeason(Date.now(), cadence) : season;
  const save = async () => {
    setStatus("");
    const saved = await onSave({
      cadenceMonths: cadence,
      revision: settings.revision,
    });
    setSaveFailed(!saved);
    if (saved)
      setStatus(
        "Season cadence saved. Stats and standings now use the new schedule.",
      );
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranked seasons</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose how often ranked seasons reset. Saving recalculates all current
          and historical Elo, stats, and standings from the saved games.
        </p>
        <div className="space-y-2">
          <p id="season-cadence-label" className="text-sm font-medium">
            Season cadence
          </p>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-labelledby="season-cadence-label"
              disabled={busy}
              render={
                <Button variant="outline" className="w-full justify-between" />
              }
            >
              {SEASON_CADENCES.find(({ months }) => months === cadence)?.label}
              <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup
                value={String(cadence)}
                onValueChange={(value) => {
                  setCadence(Number(value) as SeasonCadence);
                  setStatus("");
                }}
              >
                {SEASON_CADENCES.map(({ months, label }) => (
                  <DropdownMenuRadioItem
                    key={months}
                    value={String(months)}
                    closeOnClick
                  >
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="rounded-lg bg-muted p-3 text-sm" aria-live="polite">
          <p className="font-medium">
            {changed ? "After saving" : "Current schedule"}: {preview.label}
          </p>
          <p className="mt-1 text-muted-foreground">
            {seasonDateLabel(preview)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Boundaries follow July 2026 in Pacific time; yearly seasons start July
          1. Earlier games stay in Season 1. Season numbers and historical
          results may change. Game records are preserved.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !changed} onClick={save}>
            {busy ? "Saving…" : "Save and recalculate"}
          </Button>
          {saveFailed ? (
            <Button variant="ghost" disabled={busy} onClick={onRefresh}>
              Refresh settings
            </Button>
          ) : null}
        </div>
        {status ? <output className="block text-sm">{status}</output> : null}
      </CardContent>
    </Card>
  );
};
