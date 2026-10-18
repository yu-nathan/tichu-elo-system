# API access and security

[← Documentation overview](../README.md)

## Key management

The owner can generate named API keys under **Admin console → API access**.
Each key expires exactly 365 days after creation. The full key is displayed once;
save it in a password manager or your integration's secret store. Only its
SHA-256 hash is stored in D1. Lost keys cannot be retrieved. Revoke a lost key and
generate a replacement. Up to 10 keys can be active at once; creation is also
limited to 10 keys per hour to bound security metadata storage.

Only the owner's ChatGPT browser session can manage keys and alerts. API keys
cannot manage admins or keys, edit/archive players, or update/delete games.
The existing signed-in admin controls and public leaderboard remain available.
This API's quotas apply to `/api/v1`, not the site's existing public pages.

Send keys only over HTTPS in the `Authorization: Bearer <key>` header. Do not put
them in URLs, browser storage, logs, or source code. The API does not enable
cross-origin browser access; use it from a server-side integration.

See the [external API reference](external-api.md) for endpoints, payloads,
pagination, and safe retries.

## Limits and automatic revocation

| Limit                                   | Allowance                                         |
| --------------------------------------- | ------------------------------------------------- |
| Creation attempts per key               | 10 in any rolling hour                            |
| Reads per key                           | 300 in any rolling hour                           |
| Global creation attempts                | 20 in any rolling minute; 100 in any rolling hour |
| All authenticated API requests          | 300 per fixed minute                              |
| All API requests, before authentication | 600 per fixed minute                              |
| JSON body                               | 16 KiB, read within 5 seconds                     |

The 10/hour creation limit includes invalid authenticated requests and retries.
Reads and creations have separate per-key allowances. Global limits protect
against traffic spread across multiple keys. Shared database checks enforce
quotas across concurrent requests and Worker instances.

**A request exceeding any throttle permanently revokes the identifiable API key.**
The triggering response is `429`, with `Retry-After` and
`X-API-Key-Revoked: true`. Later requests return `401`, including after the rate
window resets. Do not automatically retry a revoked key: the owner must create a
replacement. Global traffic pressure can also trigger revocation, even when a
key has not exhausted its individual allowance. Unknown/invalid credentials
cannot revoke another key.

Other errors return `{ error }`: `400` invalid input, `401` missing/expired/revoked
key, `404` unknown endpoint, `405` unsupported method, `408` body timeout, `409`
idempotency conflict, `413` oversized body, `415` unsupported content type, and
`503` unavailable storage. Authentication and throttling fail closed. Reuse the
same idempotency identifier after an uncertain creation outcome; do not expose
credentials in error logs.

## Owner alerts

Five successful creations within 60 seconds, or an authenticated throttle
violation, create a persistent owner-only alert. Repeated activity is grouped
into 15-minute incident windows. Alerts show key labels, resource types, creation
counts, and blocked-request counts without credentials or request bodies.
Throttled keys are automatically revoked; you can also revoke a key from an alert.
Acknowledging an incident clears its unread state; new activity makes it unread
again. The owner dashboard refreshes every 30 seconds while visible.

Alerts stay for 30 days and appear when you open the owner dashboard. **No email,
push, or notification while the site is closed is sent.** The view shows up to
100 incidents, unread first, and up to 500 recent keys, active first. Temporary
rate records last at most an hour, retry records last 24 hours, and inactive key
metadata is removed 30 days after revocation or expiration. Cleanup runs on
admitted authenticated API requests and owner-management requests.

For local setup and verification, see [API migrations](development.md#external-api-migrations)
and [integration tests](development.md#external-api-integration-tests).
