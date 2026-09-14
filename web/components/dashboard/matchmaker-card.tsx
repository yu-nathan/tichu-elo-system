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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createFairMatch,
  createRandomMatch,
  type FairMatch,
  type RatingEntry,
} from "@/lib/elo";

export const MatchmakerCard = ({ active }: { active: RatingEntry[] }) => {
  const [selected, setSelected] = useState(
    () => new Set(active.map((player) => player.id)),
  );
  const [randomMatch, setRandomMatch] = useState<FairMatch | null>(null);
  const match = useMemo(
    () => createFairMatch(active.filter((player) => selected.has(player.id))),
    [active, selected],
  );
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
    setRandomMatch(
      createRandomMatch(active.filter((player) => selected.has(player.id))),
    );
  };

  return (
    <Card className="border-emerald-400/15 bg-gradient-to-br from-emerald-400/10 to-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge className="bg-emerald-300 text-emerald-950">Matchmaker</Badge>
        </div>
        <CardTitle className="mt-3 text-xl">
          {displayedMatch
            ? `${displayedMatch.gap.toFixed(1)} rating gap`
            : "Choose at least 4 players"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
                {selected.size === active.length
                  ? "All players"
                  : `${selected.size} of ${active.length} players`}
              </span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Matchmaking pool</DropdownMenuLabel>
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
    <div className="rounded-lg border border-white/8 bg-black/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-medium">{names}</p>
        </div>
        <span className="font-mono text-xs text-emerald-200">
          {rating.toFixed(1)}
        </span>
      </div>
    </div>
  );
};
