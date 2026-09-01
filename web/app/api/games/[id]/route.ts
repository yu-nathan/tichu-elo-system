import { requireAdminApi } from "@/lib/admin";
import { deleteGame, updateGame } from "@/lib/store";

const gameId = async (params: Promise<{ id: string }>) => {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) throw new Error("Invalid game ID");
  return id;
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    await updateGame(await gameId(params), await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid game" },
      { status: 400 },
    );
  }
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    await deleteGame(await gameId(params));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid game" },
      { status: 400 },
    );
  }
};
