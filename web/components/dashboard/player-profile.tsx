import {
  HeartHandshake,
  Target,
  TrendingDown,
  TrendingUp,
  Swords,
  Trophy,
} from "lucide-react";
import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Badge } from "@/components/ui/badge";
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { EloHistoryChart } from "@/components/dashboard/elo-history-chart";
import { formatPercentage, formatRatio } from "@/lib/format";
import {
  MIN_PARTNER_GAMES,
  MIN_OPPONENT_GAMES,
  tichuPartnerTitle,
  type OpponentSummary,
  type PlayerProfile,
} from "@/lib/player-profile";

const Stat = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <h3 className="text-xs text-muted-foreground">{label}</h3>
    <p className="mt-1 font-mono text-2xl font-medium">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
  </div>
);

const formatOutcome = (person: OpponentSummary, field: "wins" | "losses") =>
  `${formatPercentage(person[field], person.games)} · ${formatRatio(person[field], person.games)} games ${field === "wins" ? "won" : "lost"}`;

const PlayerHighlight = <T extends OpponentSummary>({
  title,
  description,
  partners,
  detail,
  empty,
  icon,
}: {
  title: string;
  description: string;
  partners: T[];
  detail?: (person: T) => string;
  empty: string;
  icon: ReactNode;
}) => (
  <section className="min-w-0 rounded-xl border border-border bg-card p-3">
    <h3 className="flex items-center gap-2 text-sm font-medium">
      <span className="shrink-0 text-primary">{icon}</span>
      {title}
    </h3>
    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    {partners.length ? (
      <>
        <ul className="mt-2 space-y-2 text-sm font-medium">
          {partners.map((partner) => (
            <li className="break-words" key={partner.id}>
              {partner.name}
              {detail ? (
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  {detail(partner)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {!detail ? (
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
  const partnerTitle = tichuPartnerTitle(profile.imHisBitch);
  return (
    <DialogContent className="max-w-5xl">
      <header className="pr-8">
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="border-primary/30 text-primary">
            Player profile
          </Badge>
          <InfoTooltip label="How profile highlights are ranked">
            Carrying me, Dragging me down, and {partnerTitle} require at least{" "}
            {MIN_PARTNER_GAMES} games together. Nemesis and Curbstomped require
            at least {MIN_OPPONENT_GAMES} games against the same opponent.
            Rankings balance success rates with games played, giving less weight
            to small samples. Percentages show your actual results.
          </InfoTooltip>
        </div>
        <DialogTitle className="mt-1 break-words text-2xl font-semibold">
          {player.name}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono font-medium text-primary">
            {player.rating.toFixed(1)} Elo
          </span>
          {" · "}
          {player.gamesPlayed} {player.gamesPlayed === 1 ? "game" : "games"}{" "}
          played
        </DialogDescription>
      </header>
      <div className="mt-3 space-y-3">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PlayerHighlight
            title="Best friend"
            description="Most games together"
            partners={profile.bestFriends}
            empty="No partnerships yet"
            icon={<HeartHandshake className="size-5" />}
          />
          <PlayerHighlight
            title="Carrying me"
            description="Win rate weighted by games played"
            partners={profile.carryingMe}
            detail={(person) => formatOutcome(person, "wins")}
            empty={
              profile.hasEligiblePartners
                ? "No wins with eligible partners yet"
                : `Play at least ${MIN_PARTNER_GAMES} games with a partner`
            }
            icon={<TrendingUp className="size-5" />}
          />
          <PlayerHighlight
            title="Dragging me down"
            description="Loss rate weighted by games played"
            partners={profile.draggingMeDown}
            detail={(person) => formatOutcome(person, "losses")}
            empty={
              profile.hasEligiblePartners
                ? "No losses with eligible partners yet"
                : `Play at least ${MIN_PARTNER_GAMES} games with a partner`
            }
            icon={<TrendingDown className="size-5" />}
          />
          <PlayerHighlight
            title={partnerTitle}
            description="Partner Tichu success weighted by games together"
            partners={profile.imHisBitch}
            detail={(person) =>
              `${formatPercentage(person.successfulTichus, person.tichus)} · ${formatRatio(person.successfulTichus, person.tichus)} successful calls`
            }
            empty={
              profile.hasEligiblePartners
                ? "No successful partner Tichu calls recorded with eligible partners"
                : `Play at least ${MIN_PARTNER_GAMES} games with a partner`
            }
            icon={<Target className="size-5" />}
          />
          <PlayerHighlight
            title="Nemesis"
            description="Loss rate against an opponent, weighted by games"
            partners={profile.nemesis}
            detail={(person) => formatOutcome(person, "losses")}
            empty={
              profile.hasEligibleOpponents
                ? "No losses against eligible opponents yet"
                : `Play at least ${MIN_OPPONENT_GAMES} games against an opponent`
            }
            icon={<Swords className="size-5" />}
          />
          <PlayerHighlight
            title="Curbstomped"
            description="Win rate against an opponent, weighted by games"
            partners={profile.curbstomped}
            detail={(person) => formatOutcome(person, "wins")}
            empty={
              profile.hasEligibleOpponents
                ? "No wins against eligible opponents yet"
                : `Play at least ${MIN_OPPONENT_GAMES} games against an opponent`
            }
            icon={<Trophy className="size-5" />}
          />
        </div>
      </div>
    </DialogContent>
  );
};
