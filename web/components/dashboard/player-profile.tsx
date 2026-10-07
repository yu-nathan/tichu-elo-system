import { HeartHandshake, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { EloHistoryChart } from "@/components/dashboard/elo-history-chart";
import { formatPercentage, formatRatio } from "@/lib/format";
import type { PartnerSummary, PlayerProfile } from "@/lib/player-profile";

const Stat = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <h3 className="text-xs text-muted-foreground">{label}</h3>
    <p className="mt-2 font-mono text-2xl font-medium">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
  </div>
);

const PartnerHighlight = ({
  title,
  description,
  partners,
  field,
  empty,
  icon,
}: {
  title: string;
  description: string;
  partners: PartnerSummary[];
  field: "games" | "wins" | "losses";
  empty: string;
  icon: ReactNode;
}) => (
  <section className="min-w-0 rounded-xl border border-border bg-card p-4">
    <div className="mb-3 text-primary">{icon}</div>
    <h3 className="font-medium">{title}</h3>
    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    {partners.length ? (
      <>
        <ul className="mt-3 space-y-2 text-sm font-medium">
          {partners.map((partner) => (
            <li className="break-words" key={partner.id}>
              {partner.name}
              {field !== "games" ? (
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  {formatPercentage(partner[field], partner.games)} ·{" "}
                  {formatRatio(partner[field], partner.games)}{" "}
                  {field === "wins" ? "games won" : "games lost"}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {field === "games" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {partners[0].games} {partners[0].games === 1 ? "game" : "games"}{" "}
            together{partners.length > 1 ? " each" : ""}
          </p>
        ) : null}
      </>
    ) : (
      <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
    )}
  </section>
);

export const PlayerProfileContent = ({
  profile,
}: {
  profile: PlayerProfile;
}) => {
  const { player } = profile;
  return (
    <DialogContent>
      <header className="pr-8">
        <Badge variant="outline" className="border-primary/30 text-primary">
          Player profile
        </Badge>
        <DialogTitle className="mt-3 break-words text-2xl font-semibold">
          {player.name}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          <span className="font-mono font-medium text-primary">
            {player.rating.toFixed(1)} Elo
          </span>
          {" · "}
          {player.gamesPlayed} {player.gamesPlayed === 1 ? "game" : "games"}{" "}
          played
        </DialogDescription>
      </header>
      <div className="mt-6 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Win rate"
            value={formatPercentage(profile.wins, player.gamesPlayed)}
            detail={`${profile.wins} wins · ${profile.losses} losses`}
          />
          <Stat
            label="Tichu success"
            value={formatPercentage(player.successfulTichus, player.tichus)}
            detail={
              player.tichus
                ? `${formatRatio(player.successfulTichus, player.tichus)} successful calls`
                : "No calls recorded"
            }
          />
          <Stat
            label="Grand Tichu success"
            value={formatPercentage(
              player.successfulGrandTichus,
              player.grandTichus,
            )}
            detail={
              player.grandTichus
                ? `${formatRatio(player.successfulGrandTichus, player.grandTichus)} successful calls`
                : "No calls recorded"
            }
          />
        </div>
        <EloHistoryChart history={profile.history} />
        <div className="grid gap-3 sm:grid-cols-3">
          <PartnerHighlight
            title="Best friend"
            description="Most games together"
            partners={profile.bestFriends}
            field="games"
            empty="No partnerships yet"
            icon={<HeartHandshake className="size-5" />}
          />
          <PartnerHighlight
            title="Carrying me"
            description="Highest win rate together"
            partners={profile.carryingMe}
            field="wins"
            empty="No wins together yet"
            icon={<TrendingUp className="size-5" />}
          />
          <PartnerHighlight
            title="Dragging me down"
            description="Highest loss rate together"
            partners={profile.draggingMeDown}
            field="losses"
            empty="No losses together yet"
            icon={<TrendingDown className="size-5" />}
          />
        </div>
      </div>
    </DialogContent>
  );
};
