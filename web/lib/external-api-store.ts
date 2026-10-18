import {
  API_POLICY as P,
  ApiFailure,
  hashSecret,
} from "./external-api-policy.ts";
import type {
  ApiAccessData,
  ApiIncident,
  ApiIncidentSource,
  ApiKeyInfo,
} from "./external-api-types.ts";
import type { CreationTransaction } from "./repository.ts";

export type ApiDatabase = Pick<D1Database, "prepare" | "batch">;
const keyProjection =
  "id, name, created_at AS createdAt, expires_at AS expiresAt, last_used_at AS lastUsedAt, revoked_at AS revokedAt";
export type ApiResource = "players" | "games";

export const createApiStore = (db: ApiDatabase) => {
  const cleanup = async (now: number) => {
    await db.batch([
      db
        .prepare("DELETE FROM api_rate_buckets WHERE window_start < ?")
        .bind(now - P.hourMs),
      db
        .prepare("DELETE FROM api_write_attempts WHERE at <= ?")
        .bind(now - P.hourMs),
      db
        .prepare("DELETE FROM api_read_attempts WHERE at <= ?")
        .bind(now - P.hourMs),
      db.prepare("DELETE FROM api_writes WHERE at <= ?").bind(now - P.hourMs),
      db
        .prepare("DELETE FROM api_idempotency WHERE created_at <= ?")
        .bind(now - P.idempotencyMs),
      db
        .prepare("DELETE FROM api_incidents WHERE last_at < ?")
        .bind(now - P.retentionMs),
      db
        .prepare("DELETE FROM api_keys WHERE expires_at < ? OR revoked_at < ?")
        .bind(now - P.retentionMs, now - P.retentionMs),
    ]);
  };

  const consume = async (
    scope: string,
    limit: number,
    now: number,
    duration: number = P.minuteMs,
  ) => {
    const start = Math.floor(now / duration) * duration;
    const result = await db
      .prepare(
        `INSERT INTO api_rate_buckets (scope, window_start, count) VALUES (?, ?, 1)
      ON CONFLICT(scope) DO UPDATE SET window_start = excluded.window_start,
      count = CASE WHEN window_start <> excluded.window_start THEN 1 ELSE count + 1 END
      WHERE window_start <> excluded.window_start OR count < ?`,
      )
      .bind(scope, start, limit)
      .run();
    if (!result.meta.changes)
      throw new ApiFailure(
        429,
        "Too many requests. Try again later.",
        Math.max(1, Math.ceil((start + duration - now) / 1000)),
      );
  };

  const generateKey = async (name: unknown, now: number) => {
    if (typeof name !== "string" || !name.trim() || name.trim().length > 64)
      throw new ApiFailure(400, "Enter a key name of 1–64 characters.");
    await consume("owner:key-creation", 10, now, P.hourMs);
    const key =
      "tichu_" +
      Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    const info: ApiKeyInfo = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: now,
      expiresAt: now + P.keyLifetimeMs,
      lastUsedAt: null,
      revokedAt: null,
    };
    const result = await db
      .prepare(
        `INSERT INTO api_keys (id, name, hash, created_at, expires_at)
      SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM api_keys WHERE revoked_at IS NULL AND expires_at > ?) < ?`,
      )
      .bind(
        info.id,
        info.name,
        await hashSecret(key),
        now,
        info.expiresAt,
        now,
        P.maxActiveKeys,
      )
      .run();
    if (!result.meta.changes)
      throw new ApiFailure(
        409,
        "Revoke an existing key before creating another. At most 10 keys may be active.",
      );
    return { key, info };
  };

  const authenticate = async (request: Request, now: number) => {
    const match = /^Bearer (tichu_[a-f0-9]{64})$/.exec(
      request.headers.get("authorization") ?? "",
    );
    if (!match) throw new ApiFailure(401, "A valid API key is required.");
    const key = await db
      .prepare(
        `SELECT ${keyProjection} FROM api_keys WHERE hash = ? AND revoked_at IS NULL AND expires_at > ?`,
      )
      .bind(await hashSecret(match[1]), now)
      .first<ApiKeyInfo>();
    if (!key) throw new ApiFailure(401, "A valid API key is required.");
    return key;
  };

  const incidentSources = (bucket: number) =>
    db
      .prepare(
        `INSERT INTO api_incident_sources
    (bucket, key_id, key_name, resource, created_count, blocked_count)
    SELECT ?, w.key_id, k.name, w.resource, COUNT(*), 0 FROM api_writes w JOIN api_keys k ON k.id = w.key_id
    WHERE w.at >= (SELECT first_at FROM api_incidents WHERE bucket = ?)
    GROUP BY w.key_id, k.name, w.resource
    ON CONFLICT(bucket, key_id, resource) DO UPDATE SET created_count = excluded.created_count`,
      )
      .bind(bucket, bucket);

  const incidentCount = (bucket: number) =>
    db
      .prepare(
        `UPDATE api_incidents
    SET created_count = (SELECT COUNT(*) FROM api_writes WHERE at >= api_incidents.first_at)
    WHERE bucket = ?`,
      )
      .bind(bucket);

  const recordBlocked = async (
    key: ApiKeyInfo,
    resource: ApiResource | "requests",
    now: number,
  ) => {
    const bucket = Math.floor(now / P.incidentWindowMs) * P.incidentWindowMs;
    // Revocation must survive an incident-table failure.
    await db
      .prepare(
        "UPDATE api_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?",
      )
      .bind(now, key.id)
      .run();
    await db.batch([
      db
        .prepare(
          `INSERT INTO api_incidents (bucket, first_at, last_at, created_count, blocked_count)
        VALUES (?, COALESCE((SELECT MIN(at) FROM api_writes WHERE at > ?), ?), ?, 0, 1)
        ON CONFLICT(bucket) DO UPDATE SET last_at = excluded.last_at,
        blocked_count = blocked_count + 1, acknowledged_at = NULL`,
        )
        .bind(bucket, now - P.minuteMs, now, now),
      incidentCount(bucket),
      incidentSources(bucket),
      db
        .prepare(
          `INSERT INTO api_incident_sources (bucket, key_id, key_name, resource, created_count, blocked_count)
        VALUES (?, ?, ?, ?, 0, 1) ON CONFLICT(bucket, key_id, resource) DO UPDATE SET blocked_count = blocked_count + 1`,
        )
        .bind(bucket, key.id, key.name, resource),
    ]);
  };

  const admitRead = async (keyId: string, now: number) => {
    const result = await db
      .prepare(
        `INSERT INTO api_read_attempts (id, key_id, at)
      SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM api_read_attempts WHERE key_id = ? AND at > ?) < ?`,
      )
      .bind(
        crypto.randomUUID(),
        keyId,
        now,
        keyId,
        now - P.hourMs,
        P.readsPerKeyHour,
      )
      .run();
    if (!result.meta.changes)
      throw new ApiFailure(429, "Read limit reached.", 3600);
  };

  const admitWrite = async (
    key: ApiKeyInfo,
    resource: ApiResource,
    now: number,
  ) => {
    // Conditional INSERT checks all rolling quotas in the same serialized SQL statement.
    const result = await db
      .prepare(
        `INSERT INTO api_write_attempts (id, key_id, at)
      SELECT ?, ?, ? WHERE
      (SELECT COUNT(*) FROM api_write_attempts WHERE key_id = ? AND at > ?) < ? AND
      (SELECT COUNT(*) FROM api_write_attempts WHERE at > ?) < ? AND
      (SELECT COUNT(*) FROM api_write_attempts WHERE key_id = ? AND at > ?) < ? AND
      (SELECT COUNT(*) FROM api_write_attempts WHERE at > ?) < ?`,
      )
      .bind(
        crypto.randomUUID(),
        key.id,
        now,
        key.id,
        now - P.minuteMs,
        P.writesPerKeyMinute,
        now - P.minuteMs,
        P.writesGlobalMinute,
        key.id,
        now - P.hourMs,
        P.writesPerKeyHour,
        now - P.hourMs,
        P.writesGlobalHour,
      )
      .run();
    if (!result.meta.changes) {
      // Conservative Retry-After covers whichever rolling quota was exhausted.
      const counts = await db
        .prepare(
          `SELECT
        SUM(CASE WHEN key_id = ? THEN 1 ELSE 0 END) AS perKey, COUNT(*) AS total,
        MIN(at) AS oldest FROM api_write_attempts WHERE at > ?`,
        )
        .bind(key.id, now - P.hourMs)
        .first<{ perKey: number; total: number; oldest: number | null }>();
      const retry =
        counts &&
        (counts.perKey >= P.writesPerKeyHour ||
          counts.total >= P.writesGlobalHour)
          ? 3600
          : 60;
      throw new ApiFailure(
        429,
        "Creation limit reached. Try again later.",
        retry,
      );
    }
  };

  const replay = async (
    keyId: string,
    resource: ApiResource,
    tokenHash: string,
    payloadHash: string,
    now: number,
  ) => {
    const saved = await db
      .prepare(
        `SELECT payload_hash AS payloadHash, resource_id AS resourceId FROM api_idempotency
      WHERE key_id = ? AND resource = ? AND token_hash = ? AND created_at > ?`,
      )
      .bind(keyId, resource, tokenHash, now - P.idempotencyMs)
      .first<{ payloadHash: string; resourceId: number | null }>();
    if (!saved) return null;
    if (saved.payloadHash !== payloadHash)
      throw new ApiFailure(
        409,
        "This Idempotency-Key was already used with a different payload.",
      );
    if (saved.resourceId === null)
      throw new ApiFailure(
        503,
        "The request is not complete. Retry with the same Idempotency-Key.",
      );
    return saved.resourceId;
  };

  const creationTransaction = (
    keyId: string,
    resource: ApiResource,
    tokenHash: string,
    payloadHash: string,
    now: number,
  ): CreationTransaction => {
    const bucket = Math.floor(now / P.incidentWindowMs) * P.incidentWindowMs;
    // resource is an internal enum, never interpolated from arbitrary request data.
    return {
      before: [
        db
          .prepare(
            "DELETE FROM api_idempotency WHERE key_id = ? AND resource = ? AND token_hash = ? AND created_at <= ?",
          )
          .bind(keyId, resource, tokenHash, now - P.idempotencyMs),
        // A revoked/expired key yields NULL and aborts the entire transaction.
        // A concurrent duplicate violates the PK and rolls back before any entity INSERT.
        db
          .prepare(
            `INSERT INTO api_idempotency (key_id, resource, token_hash, payload_hash, created_at)
          VALUES ((SELECT id FROM api_keys WHERE id = ? AND revoked_at IS NULL AND expires_at > ?), ?, ?, ?, ?)`,
          )
          .bind(keyId, now, resource, tokenHash, payloadHash, now),
      ],
      after: [
        db
          .prepare(
            `UPDATE api_idempotency SET resource_id = (SELECT MAX(id) FROM ${resource}) WHERE key_id = ? AND resource = ? AND token_hash = ?`,
          )
          .bind(keyId, resource, tokenHash),
        db
          .prepare(
            "INSERT INTO api_writes (id, key_id, resource, at) VALUES (?, ?, ?, ?)",
          )
          .bind(crypto.randomUUID(), keyId, resource, now),
        db
          .prepare(
            `INSERT INTO api_incidents (bucket, first_at, last_at, created_count, blocked_count)
          SELECT ?, COALESCE((SELECT MIN(at) FROM api_writes WHERE at > ?), ?), ?, 0, 0
          WHERE (SELECT COUNT(*) FROM api_writes WHERE at > ?) >= ? OR EXISTS (SELECT 1 FROM api_incidents WHERE bucket = ?)
          ON CONFLICT(bucket) DO UPDATE SET last_at = excluded.last_at, acknowledged_at = NULL`,
          )
          .bind(
            bucket,
            now - P.minuteMs,
            now,
            now,
            now - P.minuteMs,
            P.alertThreshold,
            bucket,
          ),
        incidentCount(bucket),
        incidentSources(bucket),
      ],
    };
  };

  const listAccess = async (
    now: number = Date.now(),
  ): Promise<ApiAccessData> => {
    const [keys, incidents, sources] = await Promise.all([
      db
        .prepare(
          `SELECT ${keyProjection} FROM api_keys ORDER BY (revoked_at IS NULL AND expires_at > ?) DESC, created_at DESC LIMIT 500`,
        )
        .bind(now)
        .all<ApiKeyInfo>(),
      db
        .prepare(
          `SELECT bucket, first_at AS firstAt, last_at AS lastAt, created_count AS createdCount,
        blocked_count AS blockedCount, acknowledged_at AS acknowledgedAt FROM api_incidents ORDER BY (acknowledged_at IS NOT NULL), bucket DESC LIMIT 100`,
        )
        .all<Omit<ApiIncident, "sources">>(),
      db
        .prepare(
          `SELECT bucket, key_id AS keyId, key_name AS keyName, resource,
        created_count AS createdCount, blocked_count AS blockedCount FROM api_incident_sources
        WHERE bucket IN (SELECT bucket FROM api_incidents ORDER BY (acknowledged_at IS NOT NULL), bucket DESC LIMIT 100)`,
        )
        .all<ApiIncidentSource & { bucket: number }>(),
    ]);
    return {
      keys: keys.results,
      incidents: incidents.results.map((incident) => ({
        ...incident,
        sources: sources.results
          .filter((source) => source.bucket === incident.bucket)
          .map(({ bucket: _bucket, ...source }) => source),
      })),
    };
  };

  const revoke = async (id: string, now: number) => {
    const result = await db
      .prepare(
        "UPDATE api_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?",
      )
      .bind(now, id)
      .run();
    if (!result.meta.changes) throw new ApiFailure(404, "Key not found.");
  };
  const acknowledge = async (bucket: number, now: number) => {
    const result = await db
      .prepare("UPDATE api_incidents SET acknowledged_at = ? WHERE bucket = ?")
      .bind(now, bucket)
      .run();
    if (!result.meta.changes) throw new ApiFailure(404, "Incident not found.");
  };
  const touchKey = async (id: string, now: number) => {
    const result = await db
      .prepare(
        "UPDATE api_keys SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL AND expires_at > ?",
      )
      .bind(now, id, now)
      .run();
    if (!result.meta.changes)
      throw new ApiFailure(401, "A valid API key is required.");
  };
  return {
    cleanup,
    consume,
    generateKey,
    authenticate,
    admitRead,
    admitWrite,
    replay,
    creationTransaction,
    listAccess,
    revoke,
    acknowledge,
    touchKey,
    recordBlocked,
  };
};
