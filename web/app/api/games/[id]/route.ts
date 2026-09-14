import { apiErrorResponse, parseRecordId } from "@/lib/api-errors";
import { requireAdminApi } from "@/lib/admin";
import { deleteGame, updateGame } from "@/lib/store";

const gameId = async (params: Promise<{ id: string }>) => {
  return parseRecordId((await params).id);
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const denied = await requireAdminApi();
    if (denied) return denied;
    await updateGame(await gameId(params), await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const denied = await requireAdminApi();
    if (denied) return denied;
    await deleteGame(await gameId(params));
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
};
