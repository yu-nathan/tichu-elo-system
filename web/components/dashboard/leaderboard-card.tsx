import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRatio } from "@/lib/format";
import type { RatingEntry } from "@/lib/elo";

export const LeaderboardCard = ({
  active,
  copied,
  onCopy,
}: {
  active: RatingEntry[];
  copied: boolean;
  onCopy: () => void;
}) => (
  <Card className="border-white/8 bg-card/80 shadow-2xl shadow-black/20">
    <CardHeader className="border-b border-white/8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge
            variant="outline"
            className="border-amber-300/30 text-amber-200"
          >
            Standings
          </Badge>
          <CardTitle className="mt-3 text-xl">Leaderboard</CardTitle>
        </div>
        <Button variant="secondary" size="sm" onClick={onCopy}>
          {copied ? <Check /> : <Copy />}{" "}
          {copied ? "Copied" : "Copy for Discord"}
        </Button>
      </div>
    </CardHeader>
    <CardContent className="px-0">
      <div className="hidden grid-cols-[3.5rem_1fr_5.5rem_2.5rem_4rem_4rem] px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:grid">
        <span>Rank</span>
        <span>Player</span>
        <span className="text-right">Rating</span>
        <span className="text-right">GP</span>
        <span className="text-right">GT</span>
        <span className="text-right">Tichu</span>
      </div>
      {active.map((player, index) => (
        <div key={player.id} className="border-t border-white/6">
          <div className="hidden grid-cols-[3.5rem_1fr_5.5rem_2.5rem_4rem_4rem] items-center px-5 py-3.5 sm:grid">
            <Rank index={index} />
            <span className="truncate font-medium">{player.name}</span>
            <span className="text-right font-mono text-emerald-200">
              {player.rating.toFixed(1)}
            </span>
            <span className="text-right font-mono text-muted-foreground">
              {player.gamesPlayed}
            </span>
            <SuccessRatio
              successes={player.successfulGrandTichus}
              attempts={player.grandTichus}
            />
            <SuccessRatio
              successes={player.successfulTichus}
              attempts={player.tichus}
            />
          </div>
          <div className="px-4 py-3.5 sm:hidden">
            <div className="flex items-center gap-3">
              <Rank index={index} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {player.name}
              </span>
              <span className="font-mono text-emerald-200">
                {player.rating.toFixed(1)}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 pl-8 text-[11px] text-muted-foreground">
              <span>Games {player.gamesPlayed}</span>
              <span>
                GT{" "}
                {formatRatio(player.successfulGrandTichus, player.grandTichus)}
              </span>
              <span>
                Tichu {formatRatio(player.successfulTichus, player.tichus)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);
const SuccessRatio = ({
  successes,
  attempts,
}: {
  successes: number;
  attempts: number;
}) => (
  <span className="text-right font-mono text-xs text-muted-foreground">
    {formatRatio(successes, attempts)}
  </span>
);

const Rank = ({ index }: { index: number }) => (
  <span
    className={
      index < 3 ? "font-mono text-amber-300" : "font-mono text-muted-foreground"
    }
  >
    {String(index + 1).padStart(2, "0")}
  </span>
);
