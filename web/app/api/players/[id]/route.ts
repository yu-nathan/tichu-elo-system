import { apiErrorResponse, parseRecordId } from "@/lib/api-errors";
import { requireAdminApi } from "@/lib/admin";
import { updatePlayer } from "@/lib/store";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const denied = await requireAdminApi();
    if (denied) return denied;
    const id = parseRecordId((await params).id);
    await updatePlayer(id, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
};
