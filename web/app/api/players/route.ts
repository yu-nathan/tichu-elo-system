import { getChatGPTUser } from "@/app/chatgpt-auth";
import { requireAdminApi } from "@/lib/admin";
import { createPlayer } from "@/lib/store";

export const POST = async (request: Request) => {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const user = await getChatGPTUser();
  try {
    await createPlayer(await request.json());
    return Response.json({ ok: true, by: user!.email }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid player" },
      { status: 400 },
    );
  }
};
