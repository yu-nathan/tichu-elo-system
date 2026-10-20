import { apiErrorResponse } from "@/lib/api-errors";
import { parseSeasonId } from "@/lib/seasons";
import { getSeasonStandings } from "@/lib/store";
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    return Response.json(
      await getSeasonStandings(parseSeasonId((await params).id)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
};
