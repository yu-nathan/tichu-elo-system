import { getChatGPTUser } from "@/app/chatgpt-auth";
import { env } from "cloudflare:workers";
import { hasAdminAccess } from "@/lib/admin-access";

export const getAdmin = async () => {
  const user = await getChatGPTUser();
  return user && (await hasAdminAccess(user.email, env.DB)) ? user : null;
};

export const requireAdminApi = async (): Promise<Response | null> => {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  if (!(await hasAdminAccess(user.email, env.DB))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
};
