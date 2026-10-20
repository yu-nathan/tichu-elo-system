"use client";
import { useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Player } from "@/lib/models";

export const HistoryPlayerFilter = ({
  players,
  playerId,
  onChange,
}: {
  players: Player[];
  playerId: number | null;
  onChange: (id: number | null) => void;
}) => {
  const items = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );
  return (
    <Combobox.Root
      items={items}
      value={items.find(({ id }) => id === playerId) ?? null}
      onValueChange={(player) => onChange(player?.id ?? null)}
      itemToStringLabel={(player) => player.name}
      isItemEqualToValue={(a, b) => a.id === b.id}
      autoHighlight
    >
      <div className="relative mt-3">
        <Combobox.Input
          aria-label="Filter game history by player"
          placeholder="All players · Search by name"
          render={<Input className="pr-16" />}
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          {playerId !== null ? (
            <Combobox.Clear
              aria-label="Clear player filter"
              render={<Button variant="ghost" size="icon-xs" />}
            >
              <X />
            </Combobox.Clear>
          ) : null}
          <Combobox.Trigger
            aria-label="Choose a player"
            render={<Button variant="ghost" size="icon-xs" />}
          >
            <ChevronDown />
          </Combobox.Trigger>
        </div>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50" align="start">
          <Combobox.Popup className="max-h-(--available-height) w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="p-2 text-sm text-muted-foreground empty:hidden">
              No players found.
            </Combobox.Empty>
            <Combobox.List>
              {(player: Player) => (
                <Combobox.Item
                  key={player.id}
                  value={player}
                  className="flex cursor-default items-center justify-between gap-2 rounded-md px-2 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span>{player.name}</span>
                  {player.archivedAt ? (
                    <span className="text-xs text-muted-foreground">
                      Archived
                    </span>
                  ) : null}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
};
