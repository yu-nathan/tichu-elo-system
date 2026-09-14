import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, PlayerSelect } from "@/components/form-fields";
import { CallStatsFields } from "./call-stats-fields";
import { emptyCallCounts, type GameDraft } from "@/lib/game-draft";
import type { Player } from "@/lib/models";

export const GameForm = ({
  draft,
  setDraft,
  players,
  busy,
  draftStorageFailed,
  onSubmit,
  onCancel,
}: {
  draft: GameDraft;
  setDraft: (draft: GameDraft) => void;
  players: Player[];
  busy: boolean;
  draftStorageFailed: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{draft.id ? `Edit game #${draft.id}` : "Add game"}</CardTitle>
    </CardHeader>
    <CardContent>
      <form onSubmit={onSubmit}>
        <fieldset disabled={busy} className="space-y-4">
          {draftStorageFailed ? (
            <p role="alert" className="text-sm text-muted-foreground">
              Your browser could not update the saved draft. Keep this page open
              until you save the game.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <PlayerSelect
              label="Team A player 1"
              value={draft.teamAPlayer1Id}
              players={players}
              onChange={(value) =>
                setDraft({ ...draft, teamAPlayer1Id: value })
              }
            />
            <PlayerSelect
              label="Team A player 2"
              value={draft.teamAPlayer2Id}
              players={players}
              onChange={(value) =>
                setDraft({ ...draft, teamAPlayer2Id: value })
              }
            />
            <PlayerSelect
              label="Team B player 1"
              value={draft.teamBPlayer1Id}
              players={players}
              onChange={(value) =>
                setDraft({ ...draft, teamBPlayer1Id: value })
              }
            />
            <PlayerSelect
              label="Team B player 2"
              value={draft.teamBPlayer2Id}
              players={players}
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
              onChange={(value) => setDraft({ ...draft, scoreA: value })}
            />
            <Field
              label="Team B score"
              type="number"
              value={draft.scoreB}
              onChange={(value) => setDraft({ ...draft, scoreB: value })}
            />
          </div>
          <Field
            label="Played at"
            type="datetime-local"
            value={draft.playedAt}
            onChange={(value) => setDraft({ ...draft, playedAt: value })}
          />
          <div className="rounded-lg border border-white/8 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="block font-medium">Tichu calls by player</span>
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
                players={players}
                onChange={(index, key, value) => {
                  const callStats = draft.callStats!.map((stat, statIndex) =>
                    statIndex === index ? { ...stat, [key]: value } : stat,
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
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
        </fieldset>
      </form>
    </CardContent>
  </Card>
);
