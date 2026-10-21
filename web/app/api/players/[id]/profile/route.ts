import { parseRequestedSeasonId } from "@/lib/seasons";
import { apiErrorResponse, parseRecordId } from "@/lib/api-errors";
import { getPlayerProfile } from "@/lib/store";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const profile = await getPlayerProfile(
      parseRecordId((await params).id),
      parseRequestedSeasonId(new URL(request.url).searchParams.get("seasonId")),
    );
    return Response.json(profile ?? { error: "Player not found." }, {
      status: profile ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
};
