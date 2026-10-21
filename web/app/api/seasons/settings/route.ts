import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createSeasonSettingsHandler } from "@/lib/season-settings-api";

export const PATCH = (request: Request) =>
  createSeasonSettingsHandler(env.DB, getChatGPTUser)(request);
