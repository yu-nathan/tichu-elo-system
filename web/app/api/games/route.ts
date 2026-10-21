import { parseRequestedSeasonId } from "@/lib/seasons";
import { apiErrorResponse } from "@/lib/api-errors";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { requireAdminApi } from "@/lib/admin";
import { createGame, getGamePage } from "@/lib/store";
import { parseHistoryPlayerId } from "@/lib/game-pagination";

export const POST = async (request: Request) => {
  try {
    const denied = await requireAdminApi();
    if (denied) return denied;
    const user = await getChatGPTUser();
    await createGame(await request.json(), user!.email);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
};

export const GET = async (request: Request) => {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(
      await getGamePage(
        params.get("cursor"),
        parseHistoryPlayerId(params.get("playerId")),
        parseRequestedSeasonId(params.get("seasonId")),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
};
