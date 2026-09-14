import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedDateTime } from "@/components/localized-date-time";
import type { Game } from "@/lib/models";

export const GamesCard = ({
  games,
  busy,
  onEdit,
  onDelete,
}: {
  games: Game[];
  busy: boolean;
  onEdit: (game: Game) => void;
  onDelete: (id: number) => void;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Games</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {games
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
                {game.teamACode} {game.scoreA} · {game.teamBCode} {game.scoreB}
              </p>
              <p className="text-xs text-muted-foreground">
                <LocalizedDateTime value={game.playedAt} />
              </p>
              <p className="text-xs text-muted-foreground">
                Calls: {game.callStats.length ? "recorded" : "N/A"}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={busy}
              aria-label="Edit game"
              onClick={() => onEdit(game)}
            >
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={busy}
              aria-label="Delete game"
              onClick={() => onDelete(game.id)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
    </CardContent>
  </Card>
);
