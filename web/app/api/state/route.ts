import { getAppData } from "@/lib/store";
import { apiErrorResponse } from "@/lib/api-errors";

export const GET = async () => {
  try {
    return Response.json(await getAppData(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
};
