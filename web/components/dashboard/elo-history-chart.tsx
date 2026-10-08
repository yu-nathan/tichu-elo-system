"use client";

import { useId } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { LocalizedDateTime } from "@/components/localized-date-time";
import type { RatingHistoryPoint } from "@/lib/elo";

const HistoryTooltip = ({ active, payload }: TooltipContentProps) => {
  const point: RatingHistoryPoint | undefined = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
      <p className="font-medium">
        {point.gameNumber
          ? `Game ${point.gameNumber} · ${point.result}`
          : "Starting rating"}
      </p>
      {point.playedAt ? (
        <p className="mt-1 text-muted-foreground">
          <LocalizedDateTime value={point.playedAt} />
        </p>
      ) : null}
      <p className="mt-2 font-mono">
        Elo {point.rating.toFixed(1)}
        {point.gameNumber
          ? ` (${point.delta >= 0 ? "+" : ""}${point.delta.toFixed(1)})`
          : ""}
      </p>
    </div>
  );
};

export const EloHistoryChart = ({
  history,
}: {
  history: RatingHistoryPoint[];
}) => {
  const summaryId = useId();
  const first = history[0];
  const last = history[history.length - 1];
  return (
    <section
      aria-label="Elo history"
      className="rounded-xl border border-border bg-card p-3"
    >
      <h3 className="font-medium">Elo history</h3>
      <p
        id={summaryId}
        className={
          last.gameNumber ? "sr-only" : "mt-1 text-xs text-muted-foreground"
        }
      >
        {last.gameNumber
          ? `${first.rating.toFixed(1)} starting Elo → ${last.rating.toFixed(1)} after ${last.gameNumber} games. Select a point or use the arrow keys to explore.`
          : "No games played yet. Starting Elo: 1,000.0."}
      </p>
      {last.gameNumber ? (
        <div className="mt-2 h-48 max-h-[18dvh] min-w-0 w-full sm:h-56">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              accessibilityLayer
              aria-label="Elo after each game"
              aria-describedby={summaryId}
              data={history}
              margin={{ top: 8, right: 12, bottom: 20, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="gameNumber"
                allowDecimals={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Game",
                  position: "insideBottom",
                  offset: -12,
                  fill: "var(--muted-foreground)",
                  fontSize: 12,
                }}
              />
              <YAxis
                domain={["dataMin - 20", "dataMax + 20"]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
              />
              <ReferenceLine
                y={first.rating}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
              />
              <Tooltip content={HistoryTooltip} isAnimationActive={false} />
              <Line
                type="linear"
                dataKey="rating"
                name="Elo"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={
                  history.length <= 30
                    ? { r: 3, fill: "var(--primary)" }
                    : false
                }
                activeDot={{
                  r: 5,
                  fill: "var(--primary)",
                  stroke: "var(--background)",
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  );
};
