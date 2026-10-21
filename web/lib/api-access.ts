import { isOwner } from "./admin-access.ts";
import {
  ApiFailure,
  apiJson,
  externalError,
  readApiJson,
} from "./external-api-policy.ts";
import { createApiStore, type ApiDatabase } from "./external-api-store.ts";

export type OwnerIdentity = { userId: string; email: string } | null;
export const authorizeApiOwner = (
  request: Request,
  user: OwnerIdentity,
  purpose = "API access",
) => {
  // Never combine a bearer credential with an owner's browser identity.
  if (request.headers.has("authorization") || !user?.userId)
    throw new ApiFailure(401, `Sign in with ChatGPT to manage ${purpose}.`);
  if (!isOwner(user.email)) throw new ApiFailure(403, "Owner access required.");
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    throw new ApiFailure(403, "A same-origin request is required.");
};

export const createApiAccessHandler =
  (
    db: ApiDatabase,
    getUser: () => Promise<OwnerIdentity>,
    clock: () => number = Date.now,
  ) =>
  async (request: Request) => {
    try {
      authorizeApiOwner(request, await getUser());
      const now = clock();
      const store = createApiStore(db);
      await store.consume("owner:management", 60, now);
      await store.cleanup(now);
      if (request.method === "GET") return apiJson(await store.listAccess(now));
      if (request.method !== "POST")
        return apiJson({ error: "Method not allowed." }, 405, {
          Allow: "GET, POST",
        });
      const input = await readApiJson(request);
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new ApiFailure(400, "Expected a JSON object.");
      const body = input as Record<string, unknown>;
      if (body.action === "create")
        return apiJson(await store.generateKey(body.name, now), 201);
      if (
        body.action === "revoke" &&
        typeof body.id === "string" &&
        body.id.length <= 64
      ) {
        await store.revoke(body.id, now);
        return apiJson({ ok: true });
      }
      if (
        body.action === "acknowledge" &&
        typeof body.bucket === "number" &&
        Number.isSafeInteger(body.bucket)
      ) {
        await store.acknowledge(body.bucket, now);
        return apiJson({ ok: true });
      }
      throw new ApiFailure(400, "Invalid API access action.");
    } catch (error) {
      return externalError(error);
    }
  };
