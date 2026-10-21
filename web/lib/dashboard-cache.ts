import type { DashboardData } from "./models.ts";
import {
  getCurrentSeason,
  getSeasons,
  type SeasonSettings,
  type Season,
} from "./seasons.ts";

type Database = Pick<D1Database, "prepare" | "batch">;
export type DashboardTimings = Record<string, number>;
export type DashboardContext = {
  season: Season;
  seasons: Season[];
  seasonSettings: SeasonSettings;
  now: number;
};
type State = {
  revision: number;
  cadenceMonths: SeasonSettings["cadenceMonths"];
  settingsRevision: number;
  payload: string | null;
  snapshotRevision: number | null;
  schemaVersion: number | null;
  seasonId: number | null;
  snapshotSettingsRevision: number | null;
  expiresAt: number | null;
};

const SCHEMA_VERSION = 1;
const TTL_MS = 5 * 60 * 1000;
// Identity includes the database binding. Never share data between databases.
const rebuilds = new WeakMap<Database, Map<string, Promise<boolean>>>();

export const readDashboard = async (
  db: Database,
  clock: () => number,
  build: (
    context: DashboardContext,
    timings: DashboardTimings,
  ) => Promise<DashboardData>,
  report?: (timings: DashboardTimings) => void,
): Promise<DashboardData> => {
  const started = performance.now();
  const timings: DashboardTimings = {};
  const readState = async () => {
    const start = performance.now();
    const state = await db
      .prepare(
        `SELECT r.revision,
      s.cadence_months AS cadenceMonths, s.revision AS settingsRevision,
      c.payload, c.data_revision AS snapshotRevision, c.schema_version AS schemaVersion,
      c.season_id AS seasonId, c.settings_revision AS snapshotSettingsRevision,
      c.expires_at AS expiresAt
      FROM dashboard_revision r CROSS JOIN season_settings s
      LEFT JOIN dashboard_snapshot c ON c.id = 1
      WHERE r.id = 1 AND s.id = 1`,
      )
      .first<State>();
    timings.cache_read = (timings.cache_read ?? 0) + performance.now() - start;
    if (!state)
      throw new Error(
        "Dashboard cache settings are missing. Apply migrations.",
      );
    return state;
  };
  let pending = rebuilds.get(db);
  if (!pending) {
    pending = new Map();
    rebuilds.set(db, pending);
  }
  try {
    // Re-read after every rebuild, including one joined from another request.
    // That verifies both freshness and season rollover before returning data.
    for (let attempt = 0; attempt < 4; attempt++) {
      const state = await readState();
      const now = clock();
      const season = getCurrentSeason(now, state.cadenceMonths);
      if (
        state.payload !== null &&
        state.snapshotRevision === state.revision &&
        state.schemaVersion === SCHEMA_VERSION &&
        state.seasonId === season.id &&
        state.snapshotSettingsRevision === state.settingsRevision &&
        state.expiresAt !== null &&
        now < state.expiresAt
      ) {
        try {
          const data = JSON.parse(state.payload) as DashboardData;
          if (
            data.season.id === season.id &&
            Array.isArray(data.leaderboard) &&
            Array.isArray(data.history.games)
          ) {
            timings.cache_hit = attempt === 0 ? 1 : 0;
            return data;
          }
        } catch {
          /* Rebuild an unreadable snapshot from authoritative records. */
        }
      }
      if (attempt === 3) break;
      const key = `${SCHEMA_VERSION}:${state.revision}:${season.id}:${state.settingsRevision}`;
      let rebuilding = pending.get(key);
      if (!rebuilding) {
        rebuilding = (async () => {
          const data = await build(
            {
              now,
              season,
              seasons: getSeasons(now, state.cadenceMonths),
              seasonSettings: {
                cadenceMonths: state.cadenceMonths,
                revision: state.settingsRevision,
              },
            },
            timings,
          );
          const finished = clock();
          if (getCurrentSeason(finished, state.cadenceMonths).id !== season.id)
            return false;
          const expiresAt = Math.min(
            finished + TTL_MS,
            Date.parse(season.endsAt),
          );
          const writeStart = performance.now();
          const result = await db
            .prepare(
              `INSERT INTO dashboard_snapshot
            (id, data_revision, schema_version, season_id, settings_revision, payload, expires_at)
            SELECT 1, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM dashboard_revision WHERE id = 1 AND revision = ?)
              AND EXISTS (SELECT 1 FROM season_settings WHERE id = 1 AND revision = ?)
            ON CONFLICT(id) DO UPDATE SET data_revision = excluded.data_revision,
              schema_version = excluded.schema_version, season_id = excluded.season_id,
              settings_revision = excluded.settings_revision, payload = excluded.payload,
              expires_at = excluded.expires_at`,
            )
            .bind(
              state.revision,
              SCHEMA_VERSION,
              season.id,
              state.settingsRevision,
              JSON.stringify(data),
              expiresAt,
              state.revision,
              state.settingsRevision,
            )
            .run();
          timings.cache_write =
            (timings.cache_write ?? 0) + performance.now() - writeStart;
          return result.meta.changes > 0;
        })();
        pending.set(key, rebuilding);
      }
      try {
        await rebuilding;
      } finally {
        if (pending.get(key) === rebuilding) pending.delete(key);
      }
    }
    throw new Error("Dashboard changed during calculation. Try again.");
  } finally {
    timings.total = performance.now() - started;
    report?.(timings);
  }
};
