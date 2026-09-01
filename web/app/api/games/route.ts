import { getChatGPTUser } from "@/app/chatgpt-auth";
import { requireAdminApi } from "@/lib/admin";
import { createGame } from "@/lib/store";

export const POST = async (request: Request) => {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const user = await getChatGPTUser();
  try {
    await createGame(await request.json(), user!.email);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid game" },
      { status: 400 },
    );
  }
};
