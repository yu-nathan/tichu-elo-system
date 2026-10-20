import { apiErrorResponse } from "@/lib/api-errors";
import { getDashboardData } from "@/lib/store";
export const GET = async () => {
  try {
    return Response.json(await getDashboardData(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
};
