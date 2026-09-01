import { requireAdminApi } from "@/lib/admin";
import { updatePlayer } from "@/lib/store";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isInteger(id))
    return Response.json({ error: "Invalid player ID" }, { status: 400 });
  try {
    await updatePlayer(id, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid player" },
      { status: 400 },
    );
  }
};
