export const API_POLICY = {
  minuteMs: 60_000,
  hourMs: 3_600_000,
  keyLifetimeMs: 365 * 86_400_000,
  maxActiveKeys: 10,
  preAuthPerMinute: 600,
  readsPerKeyHour: 300,
  requestsGlobal: 300,
  writesPerKeyMinute: 10,
  writesGlobalMinute: 20,
  writesPerKeyHour: 10,
  writesGlobalHour: 100,
  maxBodyBytes: 16 * 1024,
  bodyTimeoutMs: 5_000,
  idempotencyMs: 86_400_000,
  alertThreshold: 5,
  incidentWindowMs: 15 * 60_000,
  retentionMs: 30 * 86_400_000,
} as const;

export class ApiFailure extends Error {
  readonly status: number;
  readonly retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export const hashSecret = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

export const readApiJson = async (request: Request): Promise<unknown> => {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new ApiFailure(415, "JSON request required.");
  const declared = request.headers.get("content-length");
  if (
    declared &&
    (!/^\d+$/.test(declared) || Number(declared) > API_POLICY.maxBodyBytes)
  )
    throw new ApiFailure(413, "Request body exceeds 16 KiB.");
  if (!request.body) throw new ApiFailure(400, "JSON request required.");
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiFailure(408, "Request body timed out."));
      void reader.cancel().catch(() => {});
    }, API_POLICY.bodyTimeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let bytes = 0;
        let body = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > API_POLICY.maxBodyBytes)
            throw new ApiFailure(413, "Request body exceeds 16 KiB.");
          body += decoder.decode(value, { stream: true });
        }
        return JSON.parse(body + decoder.decode()) as unknown;
      })(),
      timeout,
    ]);
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    throw new ApiFailure(400, "Invalid JSON request.");
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
};

export const apiJson = (
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });

export const externalError = (error: unknown) => {
  // Do not log raw database errors: they may contain bound credentials or payloads.
  if (error instanceof ApiFailure)
    return apiJson(
      { error: error.message },
      error.status,
      error.retryAfter === undefined
        ? {}
        : { "Retry-After": String(error.retryAfter) },
    );
  return apiJson(
    { error: "The service is temporarily unavailable. Try again." },
    503,
  );
};
