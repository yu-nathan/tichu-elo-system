import { apiErrorResponse } from "@/lib/api-errors";
import { getDashboardData } from "@/lib/store";
export const GET = async () => {
  try {
    let serverTiming = "";
    const data = await getDashboardData((timings) => {
      serverTiming = Object.entries(timings)
        .filter(([name]) => name !== "cache_hit")
        .map(([name, duration]) => `${name};dur=${duration.toFixed(2)}`)
        .join(", ");
    });
    return Response.json(data, {
      headers: { "Cache-Control": "no-store", "Server-Timing": serverTiming },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
};
