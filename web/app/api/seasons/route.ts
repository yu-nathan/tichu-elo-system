import { getCurrentSeason, getSeasons } from "@/lib/seasons";
export const GET = async () => {
  const now = Date.now();
  return Response.json(
    { season: getCurrentSeason(now), seasons: getSeasons(now) },
    { headers: { "Cache-Control": "no-store" } },
  );
};
