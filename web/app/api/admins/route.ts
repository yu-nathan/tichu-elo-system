import { apiErrorResponse } from "@/lib/api-errors";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { addAdmin, isOwner, listAdmins } from "@/lib/admin-access";

export const POST = async (request: Request) => {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isOwner(user.email)) {
    return Response.json({ error: "Owner access required" }, { status: 403 });
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  ) {
    return Response.json({ error: "JSON request required" }, { status: 415 });
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const email =
    typeof input === "object" && input !== null && "email" in input
      ? input.email
      : undefined;
  try {
    const existingAdmins = await listAdmins(env.DB);
    const added = await addAdmin(email, user.email, env.DB);
    return Response.json(
      {
        admins: [
          existingAdmins[0],
          ...[...existingAdmins.slice(1), added].sort((a, b) =>
            a.email.localeCompare(b.email),
          ),
        ],
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
};
