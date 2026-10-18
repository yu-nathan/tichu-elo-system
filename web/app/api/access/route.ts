import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createApiAccessHandler } from "@/lib/api-access";

const handle = (request: Request) =>
  createApiAccessHandler(env.DB, getChatGPTUser)(request);
export { handle as GET, handle as POST };
