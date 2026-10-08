import { apiErrorResponse, parseRecordId } from "@/lib/api-errors";
import { getPlayerProfile } from "@/lib/store";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const profile = await getPlayerProfile(parseRecordId((await params).id));
    return Response.json(profile ?? { error: "Player not found." }, {
      status: profile ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
};
