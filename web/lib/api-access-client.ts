import type { ApiAccessData, ApiKeyInfo } from "./external-api-types.ts";

const accessRequest = async <T>(body?: unknown, signal?: AbortSignal) => {
  const response = await fetch("/api/access", {
    method: body ? "POST" : "GET",
    cache: "no-store",
    signal,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data ? data.error : null;
    throw new Error(
      typeof error === "string" ? error : "Could not manage API access.",
    );
  }
  return data as T;
};
export const fetchApiAccess = (signal?: AbortSignal): Promise<ApiAccessData> =>
  accessRequest(undefined, signal);
export const generateApiKey = (
  name: string,
): Promise<{ key: string; info: ApiKeyInfo }> =>
  accessRequest({ action: "create", name });
export const revokeApiKey = (id: string): Promise<{ ok: true }> =>
  accessRequest({ action: "revoke", id });
export const acknowledgeApiIncident = (bucket: number): Promise<{ ok: true }> =>
  accessRequest({ action: "acknowledge", bucket });
