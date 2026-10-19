"use client";

import type { FormEvent } from "react";
import { useSiteTheme } from "@/components/seasonal-theme-provider";
import { ThemeControls } from "@/components/dashboard/theme-controls";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiAccessCard } from "@/components/admin/api-access-card";
import { useApiAccess } from "@/hooks/use-api-access";
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
  const season = useSiteTheme();
  const apiAccess = useApiAccess(Boolean(initialAdmins));
  const unreadApiAlerts =
    apiAccess.data?.incidents.filter((incident) => !incident.acknowledgedAt)
      .length ?? 0;
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
    <main className="seasonal-admin h-dvh overflow-hidden px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col">
        <header className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seasonal-brand">
              Tichu Elo
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Admin console</h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={
                <a href={season.preview ? `/?theme=${season.preview}` : "/"} />
              }
            >
              <ArrowLeft /> Leaderboard
            </Button>
            <ThemeControls
              season={season}
              canPreviewThemes={Boolean(initialAdmins)}
            />
          </div>
        </header>
        {unreadApiAlerts > 0 ? (
          <output className="mb-4 shrink-0 rounded-lg border border-border bg-muted p-3 text-sm">
            {unreadApiAlerts} unread API activity{" "}
            {unreadApiAlerts === 1 ? "alert" : "alerts"}.{" "}
            <a href="#api-access" className="font-medium underline">
              Review API access
            </a>
          </output>
        ) : null}
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
        <section
          aria-label="Admin content"
          className="grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain p-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[1.1fr_.9fr]"
        >
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
              <>
                <ApiAccessCard access={apiAccess} />
                <AdminsCard initialAdmins={initialAdmins} />
              </>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
};
