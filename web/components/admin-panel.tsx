"use client";

import type { FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminsCard } from "@/components/admins-card";
import { GameForm } from "@/components/admin/game-form";
import { GamesCard } from "@/components/admin/games-card";
import { PlayersCard } from "@/components/admin/players-card";
import { useAdminData } from "@/hooks/use-admin-data";
import { useGameEditor } from "@/hooks/use-game-editor";
import * as api from "@/lib/api-client";
import { gameDraftToInput } from "@/lib/game-draft";
import { errorMessage } from "@/lib/mutation";
import type { AdminEntry } from "@/lib/admin-access";
import type { AppData } from "@/lib/models";

type Props = { initialData: AppData; initialAdmins: AdminEntry[] | null };

export const AdminPanel = ({ initialData, initialAdmins }: Props) => {
  const { data, busy, error, warning, setError, mutate, refresh } =
    useAdminData(initialData);
  const editor = useGameEditor(data.players);
  const { draft, resetDraft } = editor;
  const disabled = busy || Boolean(warning);

  const submitGame = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    let input;
    try {
      input = gameDraftToInput(draft);
    } catch (error) {
      setError(errorMessage(error, "Complete the game details."));
      return;
    }
    if (await mutate(() => api.saveGame(input, draft.id))) resetDraft();
  };

  const deleteGame = async (id: number) => {
    if (
      disabled ||
      !window.confirm(
        "Delete this game permanently? Ratings will be recalculated.",
      )
    )
      return;
    if (await mutate(() => api.deleteGame(id))) {
      if (draft.id === id) resetDraft();
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
          <Button variant="ghost" nativeButton={false} render={<a href="/" />}>
            <ArrowLeft /> Leaderboard
          </Button>
        </header>
        {error ? (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </p>
        ) : null}
        {warning ? (
          <div className="mb-5 space-y-2 text-sm">
            <output className="block">{warning}</output>
            <Button disabled={busy} onClick={refresh}>
              Refresh data
            </Button>
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="space-y-6">
            <GameForm
              {...editor}
              players={data.players}
              busy={disabled}
              onSubmit={submitGame}
              onCancel={resetDraft}
            />
            <GamesCard
              games={data.games}
              busy={disabled}
              onEdit={editor.editGame}
              onDelete={deleteGame}
            />
          </section>
          <section className="space-y-6">
            <PlayersCard
              players={data.players}
              busy={disabled}
              onCreate={(input) => mutate(() => api.createPlayer(input))}
              onUpdate={(id, input) =>
                mutate(() => api.updatePlayer(id, input))
              }
            />
            {initialAdmins ? (
              <AdminsCard initialAdmins={initialAdmins} />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
};
