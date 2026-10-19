"use client";
import { useMemo, useState } from "react";
import { ChevronDown, Shuffle, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createFairMatch,
  createRandomMatch,
  type FairMatch,
  type RatingEntry,
} from "@/lib/elo";

export const MatchmakerCard = ({ active }: { active: RatingEntry[] }) => {
  const [selected, setSelected] = useState(() => new Set<number>());
  const [randomMatch, setRandomMatch] = useState<FairMatch | null>(null);
  const pool = useMemo(
    () =>
      selected.size
        ? active.filter((player) => selected.has(player.id))
        : active,
    [active, selected],
  );
  const match = useMemo(() => createFairMatch(pool), [pool]);
  const displayedMatch = randomMatch ?? match;

  const togglePlayer = (id: number) => {
    setRandomMatch(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const randomizeTeams = () => {
    setRandomMatch(createRandomMatch(pool));
  };

  return (
    <Card className="min-h-0 gap-3 py-3 border-seasonal-tint/15 bg-gradient-to-br from-seasonal-tint/10 to-card">
      <CardHeader className="shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge className="bg-seasonal-brand text-seasonal-brand-foreground">
            Matchmaker
          </Badge>
          {displayedMatch ? (
            <span className="text-xs font-medium text-primary">
              {randomMatch ? "Random matchup" : "Fairest matchup"}
            </span>
          ) : null}
        </div>
        <CardTitle className="mt-1 text-xl">
          {displayedMatch
            ? `${displayedMatch.gap.toFixed(1)} rating gap`
            : "Choose at least 4 players"}
        </CardTitle>
      </CardHeader>
      <CardContent
        as="section"
        aria-label="Matchmaking controls"
        tabIndex={0}
        className="min-h-0 overflow-y-auto overscroll-contain space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Users className="size-3.5" /> Eligible players
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="w-full justify-between" />
              }
            >
              <span>
                {active.length > 0 && selected.size === 0
                  ? "All active players (default)"
                  : active.length > 0 && selected.size === active.length
                    ? "All players"
                    : `${selected.size} of ${active.length} players`}
              </span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Matchmaking pool</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={!active.length || selected.size === active.length}
                  onClick={() => {
                    setSelected(new Set(active.map(({ id }) => id)));
                    setRandomMatch(null);
                  }}
                >
                  Include all players
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {active.map((player) => (
                  <DropdownMenuCheckboxItem
                    key={player.id}
                    checked={selected.has(player.id)}
                    closeOnClick={false}
                    onCheckedChange={() => togglePlayer(player.id)}
                  >
                    {player.name}
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {player.rating.toFixed(0)}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!randomMatch}
            onClick={() => setRandomMatch(null)}
          >
            <Sparkles /> Find fair teams
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!match}
            onClick={randomizeTeams}
          >
            <Shuffle /> Randomize teams
          </Button>
        </div>
        {displayedMatch ? (
          <div className="space-y-2">
            <Team
              label="Team one"
              names={displayedMatch.teamA.map((p) => p.name).join(" + ")}
              rating={displayedMatch.ratingA}
            />
            <Team
              label="Team two"
              names={displayedMatch.teamB.map((p) => p.name).join(" + ")}
              rating={displayedMatch.ratingB}
            />
            {displayedMatch.benched.length ? (
              <p className="text-xs text-muted-foreground">
                Benched: {displayedMatch.benched.map((p) => p.name).join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
const Team = ({
  label,
  names,
  rating,
}: {
  label: string;
  names: string;
  rating: number;
}) => {
  return (
    <div className="rounded-lg border border-white/8 bg-black/15 p-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-medium">{names}</p>
        </div>
        <span className="font-mono text-xs text-seasonal-rating">
          {rating.toFixed(1)}
        </span>
      </div>
    </div>
  );
};
