"use client";

import { useState } from "react";
import { ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Player, PlayerInput, PlayerUpdate } from "@/lib/models";

export const PlayersCard = ({
  players,
  busy,
  onCreate,
  onUpdate,
}: {
  players: Player[];
  busy: boolean;
  onCreate: (input: PlayerInput) => Promise<boolean>;
  onUpdate: (id: number, input: PlayerUpdate) => Promise<boolean>;
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const addPlayer = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (await onCreate({ code, name })) {
      setCode("");
      setName("");
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Players</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="grid grid-cols-[5rem_1fr_auto] gap-2"
          onSubmit={addPlayer}
        >
          <Input
            disabled={busy}
            required
            maxLength={3}
            placeholder="Code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <Input
            disabled={busy}
            required
            maxLength={40}
            placeholder="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="submit"
            disabled={busy}
            size="icon"
            aria-label="Add player"
          >
            <Plus />
          </Button>
        </form>
        <div className="space-y-2">
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              busy={busy}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const PlayerRow = ({
  player,
  busy,
  onUpdate,
}: {
  player: Player;
  busy: boolean;
  onUpdate: (id: number, input: PlayerUpdate) => Promise<boolean>;
}) => {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(player.code);
  const [name, setName] = useState(player.name);

  const save = async () => {
    if (await onUpdate(player.id, { code, name })) {
      setEditing(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/8 p-3">
      {editing ? (
        <div className="grid grid-cols-[4.5rem_1fr_auto] gap-2">
          <Input
            disabled={busy}
            maxLength={3}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <Input
            disabled={busy}
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button disabled={busy} size="sm" onClick={save}>
            Save
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="w-8 font-mono text-sm text-emerald-200">
            {player.code}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{player.name}</span>
          {player.archivedAt ? (
            <span className="text-xs text-muted-foreground">Archived</span>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Edit player"
            disabled={busy}
            onClick={() => {
              setCode(player.code);
              setName(player.name);
              setEditing(true);
            }}
          >
            <Pencil />
          </Button>
          <Button
            disabled={busy}
            size="icon-sm"
            variant="ghost"
            aria-label={player.archivedAt ? "Restore player" : "Archive player"}
            onClick={() =>
              onUpdate(player.id, {
                archived: !player.archivedAt,
              })
            }
          >
            <ArchiveRestore />
          </Button>
        </div>
      )}
    </div>
  );
};
