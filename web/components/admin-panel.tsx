"use client";

import { useMemo, useState } from "react";
import { ArchiveRestore, ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminsCard } from "@/components/admins-card";
import type { AdminEntry } from "@/lib/admin-access";
import type { AppData, Game, Player } from "@/lib/store";

type Props = { initialData: AppData; initialAdmins: AdminEntry[] | null };
type CallCounts = {
  grandTichus: number;
  successfulGrandTichus: number;
  tichus: number;
  successfulTichus: number;
};
type GameDraft = {
  id?: number;
  teamAPlayer1Id: number;
  teamAPlayer2Id: number;
  teamBPlayer1Id: number;
  teamBPlayer2Id: number;
  scoreA: number;
  scoreB: number;
  playedAt: string;
  callStats: CallCounts[] | null;
};

const emptyCallCounts = (): CallCounts => ({
  grandTichus: 0,
  successfulGrandTichus: 0,
  tichus: 0,
  successfulTichus: 0,
});

const toLocalDateTime = (value: string) =>
  new Date(value).toISOString().slice(0, 16);

const newGameDraft = (playerIds: number[]): GameDraft => ({
  teamAPlayer1Id: playerIds[0] ?? 0,
  teamAPlayer2Id: playerIds[1] ?? 0,
  teamBPlayer1Id: playerIds[2] ?? 0,
  teamBPlayer2Id: playerIds[3] ?? 0,
  scoreA: 0,
  scoreB: 0,
  playedAt: toLocalDateTime(new Date().toISOString()),
  callStats: null,
});

export const AdminPanel = ({ initialData, initialAdmins }: Props) => {
  const [data, setData] = useState(initialData);
  const activeIds = useMemo(
    () =>
      data.players
        .filter((player) => !player.archivedAt)
        .map((player) => player.id),
    [data.players],
  );
  const [draft, setDraft] = useState<GameDraft>(() => newGameDraft(activeIds));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    setData(await response.json());
  };

  const mutate = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error ?? "The change could not be saved.");
      }
      await refresh();
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The change could not be saved.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitGame = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const playerIds = [
      draft.teamAPlayer1Id,
      draft.teamAPlayer2Id,
      draft.teamBPlayer1Id,
      draft.teamBPlayer2Id,
    ];
    const body = {
      ...draft,
      playedAt: new Date(draft.playedAt).toISOString(),
      callStats: draft.callStats?.map((stat, index) => ({
        playerId: playerIds[index],
        ...stat,
      })),
    };
    const saved = await mutate(
      draft.id ? `/api/games/${draft.id}` : "/api/games",
      draft.id ? "PATCH" : "POST",
      body,
    );
    if (saved) setDraft(newGameDraft(activeIds));
  };

  const editGame = (game: Game) => {
    const playerIds = [
      game.teamAPlayer1Id,
      game.teamAPlayer2Id,
      game.teamBPlayer1Id,
      game.teamBPlayer2Id,
    ];
    setDraft({
      id: game.id,
      teamAPlayer1Id: game.teamAPlayer1Id,
      teamAPlayer2Id: game.teamAPlayer2Id,
      teamBPlayer1Id: game.teamBPlayer1Id,
      teamBPlayer2Id: game.teamBPlayer2Id,
      scoreA: game.scoreA,
      scoreB: game.scoreB,
      playedAt: toLocalDateTime(game.playedAt),
      callStats: game.callStats.length
        ? playerIds.map((playerId) => {
            const stat = game.callStats.find(
              (entry) => entry.playerId === playerId,
            );
            return stat
              ? {
                  grandTichus: stat.grandTichus,
                  successfulGrandTichus: stat.successfulGrandTichus,
                  tichus: stat.tichus,
                  successfulTichus: stat.successfulTichus,
                }
              : emptyCallCounts();
          })
        : null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteGame = async (id: number) => {
    if (
      window.confirm(
        "Delete this game permanently? Ratings will be recalculated.",
      )
    ) {
      await mutate(`/api/games/${id}`, "DELETE");
    }
  };

  return (
    <main className="min-h-screen px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Tichu Elo
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Admin console</h1>
          </div>
          <Button variant="ghost" render={<a href="/" />}>
            <ArrowLeft /> Leaderboard
          </Button>
        </header>

        {error ? (
          <p className="mb-5 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {draft.id ? `Edit game #${draft.id}` : "Add game"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitGame}>
                  <div className="grid grid-cols-2 gap-3">
                    <PlayerSelect
                      label="Team A player 1"
                      value={draft.teamAPlayer1Id}
                      data={data}
                      onChange={(value) =>
                        setDraft({ ...draft, teamAPlayer1Id: value })
                      }
                    />
                    <PlayerSelect
                      label="Team A player 2"
                      value={draft.teamAPlayer2Id}
                      data={data}
                      onChange={(value) =>
                        setDraft({ ...draft, teamAPlayer2Id: value })
                      }
                    />
                    <PlayerSelect
                      label="Team B player 1"
                      value={draft.teamBPlayer1Id}
                      data={data}
                      onChange={(value) =>
                        setDraft({ ...draft, teamBPlayer1Id: value })
                      }
                    />
                    <PlayerSelect
                      label="Team B player 2"
                      value={draft.teamBPlayer2Id}
                      data={data}
                      onChange={(value) =>
                        setDraft({ ...draft, teamBPlayer2Id: value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Team A score"
                      type="number"
                      value={draft.scoreA}
                      onChange={(value) =>
                        setDraft({ ...draft, scoreA: Number(value) })
                      }
                    />
                    <Field
                      label="Team B score"
                      type="number"
                      value={draft.scoreB}
                      onChange={(value) =>
                        setDraft({ ...draft, scoreB: Number(value) })
                      }
                    />
                  </div>
                  <Field
                    label="Played at"
                    type="datetime-local"
                    value={draft.playedAt}
                    onChange={(value) =>
                      setDraft({ ...draft, playedAt: value })
                    }
                  />
                  <div className="rounded-lg border border-white/8 p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        <span className="block font-medium">
                          Tichu calls by player
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {draft.callStats
                            ? "Record attempts and successful calls per player."
                            : "N/A for this game"}
                        </span>
                      </span>
                      <input
                        aria-label="Record Tichu calls for this game"
                        type="checkbox"
                        className="size-4 accent-emerald-400"
                        checked={Boolean(draft.callStats)}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            callStats: event.target.checked
                              ? Array.from({ length: 4 }, emptyCallCounts)
                              : null,
                          })
                        }
                      />
                    </div>
                    {draft.callStats ? (
                      <CallStatsFields
                        draft={draft}
                        data={data}
                        onChange={(index, key, value) => {
                          const callStats = draft.callStats!.map(
                            (stat, statIndex) =>
                              statIndex === index
                                ? { ...stat, [key]: Number(value) }
                                : stat,
                          );
                          setDraft({ ...draft, callStats });
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button disabled={busy} type="submit">
                      <Plus /> {draft.id ? "Save changes" : "Add game"}
                    </Button>
                    {draft.id ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setDraft(newGameDraft(activeIds))}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Games</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.games
                  .slice()
                  .reverse()
                  .map((game) => (
                    <div
                      key={game.id}
                      className="flex items-center gap-3 rounded-lg border border-white/8 p-3"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        #{game.id}
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate">
                          {game.teamACode} {game.scoreA} · {game.teamBCode}{" "}
                          {game.scoreB}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(game.playedAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Calls: {game.callStats.length ? "recorded" : "N/A"}
                        </p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Edit game"
                        onClick={() => editGame(game)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete game"
                        onClick={() => deleteGame(game.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <PlayersCard data={data} busy={busy} mutate={mutate} />
            {initialAdmins ? (
              <AdminsCard initialAdmins={initialAdmins} />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
};

const CallStatsFields = ({
  draft,
  data,
  onChange,
}: {
  draft: GameDraft;
  data: AppData;
  onChange: (index: number, key: keyof CallCounts, value: string) => void;
}) => {
  const playerIds = [
    draft.teamAPlayer1Id,
    draft.teamAPlayer2Id,
    draft.teamBPlayer1Id,
    draft.teamBPlayer2Id,
  ];
  return (
    <div className="mt-4 space-y-3">
      {draft.callStats!.map((stat, index) => {
        const player = data.players.find(({ id }) => id === playerIds[index]);
        return (
          <div key={index} className="rounded-md bg-black/15 p-3">
            <p className="mb-2 text-xs font-semibold text-emerald-200">
              {player?.name ?? `Player ${index + 1}`}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field
                label="Grand Tichu called"
                type="number"
                min={0}
                value={stat.grandTichus}
                onChange={(value) => onChange(index, "grandTichus", value)}
              />
              <Field
                label="Grand Tichu successful"
                type="number"
                min={0}
                value={stat.successfulGrandTichus}
                onChange={(value) =>
                  onChange(index, "successfulGrandTichus", value)
                }
              />
              <Field
                label="Tichu called"
                type="number"
                min={0}
                value={stat.tichus}
                onChange={(value) => onChange(index, "tichus", value)}
              />
              <Field
                label="Tichu successful"
                type="number"
                min={0}
                value={stat.successfulTichus}
                onChange={(value) => onChange(index, "successfulTichus", value)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

type FieldProps = {
  label: string;
  type: string;
  value: string | number;
  min?: number;
  onChange: (value: string) => void;
};

const Field = ({ label, type, value, min, onChange }: FieldProps) => (
  <label className="flex min-w-0 flex-col gap-1.5 text-sm">
    <span className="flex-1 text-xs font-medium text-muted-foreground">
      {label}
    </span>
    <Input
      required
      type={type}
      min={min}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

type PlayerSelectProps = {
  label: string;
  value: number;
  data: AppData;
  onChange: (value: number) => void;
};

const PlayerSelect = ({ label, value, data, onChange }: PlayerSelectProps) => (
  <label className="flex min-w-0 flex-col gap-1.5 text-sm">
    <span className="flex-1 text-xs font-medium text-muted-foreground">
      {label}
    </span>
    <select
      className="h-9 w-full rounded-lg border border-input bg-input/30 px-2 text-sm"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {data.players.map((player) => (
        <option
          key={player.id}
          value={player.id}
          disabled={Boolean(player.archivedAt)}
        >
          {player.code} · {player.name}
          {player.archivedAt ? " (archived)" : ""}
        </option>
      ))}
    </select>
  </label>
);

type Mutate = (url: string, method: string, body?: unknown) => Promise<boolean>;

const PlayersCard = ({
  data,
  busy,
  mutate,
}: {
  data: AppData;
  busy: boolean;
  mutate: Mutate;
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const addPlayer = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (await mutate("/api/players", "POST", { code, name })) {
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
            required
            maxLength={3}
            placeholder="Code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <Input
            required
            maxLength={40}
            placeholder="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button disabled={busy} size="icon" aria-label="Add player">
            <Plus />
          </Button>
        </form>
        <div className="space-y-2">
          {data.players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              busy={busy}
              mutate={mutate}
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
  mutate,
}: {
  player: Player;
  busy: boolean;
  mutate: Mutate;
}) => {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(player.code);
  const [name, setName] = useState(player.name);

  const save = async () => {
    if (await mutate(`/api/players/${player.id}`, "PATCH", { code, name })) {
      setEditing(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/8 p-3">
      {editing ? (
        <div className="grid grid-cols-[4.5rem_1fr_auto] gap-2">
          <Input
            maxLength={3}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <Input
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
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
          <Button
            disabled={busy}
            size="icon-sm"
            variant="ghost"
            aria-label={player.archivedAt ? "Restore player" : "Archive player"}
            onClick={() =>
              mutate(`/api/players/${player.id}`, "PATCH", {
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
