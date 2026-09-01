import { getChatGPTUser } from "@/app/chatgpt-auth";

export const ADMIN_EMAIL = "nyu1997@gmail.com";

export const getAdmin = async () => {
  const user = await getChatGPTUser();
  return user && user.email.trim().toLowerCase() === ADMIN_EMAIL ? user : null;
};

export const requireAdminApi = async (): Promise<Response | null> => {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.email.trim().toLowerCase() !== ADMIN_EMAIL) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
};
