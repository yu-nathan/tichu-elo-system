import { Field } from "@/components/form-fields";
import type { GameDraft, CallCounts } from "@/lib/game-draft";
import type { Player } from "@/lib/models";

export const CallStatsFields = ({
  draft,
  players,
  onChange,
}: {
  draft: GameDraft;
  players: Player[];
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
        const player = players.find(({ id }) => id === playerIds[index]);
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
