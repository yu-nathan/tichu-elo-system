import { authorizeApiOwner, type OwnerIdentity } from "./api-access.ts";
import { InputError } from "./input.ts";
import { apiJson, externalError, readApiJson } from "./external-api-policy.ts";
import { createRepository } from "./repository.ts";
import { SeasonSettingsConflict } from "./seasons.ts";

export const createSeasonSettingsHandler =
  (
    db: Pick<D1Database, "prepare" | "batch">,
    getUser: () => Promise<OwnerIdentity>,
  ) =>
  async (request: Request) => {
    try {
      authorizeApiOwner(request, await getUser(), "ranked seasons");
      if (request.method !== "PATCH")
        return apiJson({ error: "Method not allowed." }, 405, {
          Allow: "PATCH",
        });
      await createRepository(db).updateSeasonSettings(
        await readApiJson(request),
      );
      return apiJson({ ok: true });
    } catch (error) {
      if (error instanceof SeasonSettingsConflict)
        return apiJson({ error: error.message }, 409);
      if (error instanceof InputError)
        return apiJson({ error: error.message }, 400);
      return externalError(error);
    }
  };
