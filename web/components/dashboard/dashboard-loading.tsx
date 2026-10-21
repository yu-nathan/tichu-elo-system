import { Sparkles } from "lucide-react";
import { PanelPlaceholder } from "@/components/dashboard/panel-placeholder";

const Loading = () => (
  <main
    className="h-dvh overflow-hidden text-foreground"
    data-dashboard-shell="true"
  >
    <div className="relative z-10 mx-auto flex h-full min-h-0 max-w-7xl flex-col px-3 py-3 sm:px-6 lg:px-8">
      <header className="mb-3 flex min-h-8 shrink-0 items-center border-b border-white/8 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-seasonal-brand">
            <Sparkles className="size-3.5" /> Tichu Elo
          </div>
          <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
            Live standings, match history, and balanced teams.
          </p>
        </div>
      </header>
      <p role="status" className="sr-only">
        Loading standings…
      </p>
      <div
        aria-hidden="true"
        className="mb-3 grid h-10 shrink-0 grid-cols-3 items-center rounded-lg bg-muted px-2 text-center text-sm lg:hidden"
      >
        <span>Leaderboard</span>
        <span>Matchmaker</span>
        <span>Recent games</span>
      </div>
      <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_.8fr] lg:grid-rows-[minmax(--spacing(90),max-content)_minmax(0,1fr)]">
        <div className="min-h-0 lg:row-span-2">
          <PanelPlaceholder title="Leaderboard" />
        </div>
        <div className="hidden min-h-0 lg:block">
          <PanelPlaceholder title="Matchmaker" />
        </div>
        <div className="hidden min-h-0 lg:block">
          <PanelPlaceholder title="Recent games" />
        </div>
      </section>
    </div>
  </main>
);
export default Loading;
