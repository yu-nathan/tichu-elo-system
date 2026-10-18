import { env } from "cloudflare:workers";
import { createExternalApi } from "@/lib/external-api";

const handle = (request: Request) => createExternalApi(env.DB)(request);
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
  handle as OPTIONS,
};
