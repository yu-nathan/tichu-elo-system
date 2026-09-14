import { apiErrorResponse } from "@/lib/api-errors";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { requireAdminApi } from "@/lib/admin";
import { createGame } from "@/lib/store";

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
