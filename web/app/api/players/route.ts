import { apiErrorResponse } from "@/lib/api-errors";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { requireAdminApi } from "@/lib/admin";
import { createPlayer } from "@/lib/store";

export const POST = async (request: Request) => {
  try {
    const denied = await requireAdminApi();
    if (denied) return denied;
    const user = await getChatGPTUser();
    await createPlayer(await request.json());
    return Response.json({ ok: true, by: user!.email }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
};
