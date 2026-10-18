"use client";
import { useId, useState } from "react";
import { KeyRound, Copy, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useClipboard } from "@/hooks/use-clipboard";
import type { useApiAccess } from "@/hooks/use-api-access";

const dateTime = (value: number) => new Date(value).toLocaleString();

export const ApiAccessCard = ({
  access,
}: {
  access: ReturnType<typeof useApiAccess>;
}) => {
  const [name, setName] = useState("");
  const inputId = useId();
  const clipboard = useClipboard();
  const now = access.observedAt;
  const active =
    access.data?.keys.filter((key) => !key.revokedAt && key.expiresAt > now)
      .length ?? 0;
  return (
    <Card id="api-access">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5" /> API access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Only you can create and revoke keys. Keys can read leaderboard data
          and create games and players. They cannot edit or delete records.
        </p>
        <p className="text-sm text-muted-foreground">
          Keys expire after 365 days. Each key allows 10 creation attempts and
          300 reads per rolling hour. Exceeding any API throttle permanently
          revokes the key and raises an alert here. Alerts refresh while this
          page is visible; no email is sent.
        </p>
        {access.error ? (
          <p role="alert" className="text-sm">
            {access.error}{" "}
            <Button
              variant="ghost"
              size="sm"
              disabled={access.busy}
              onClick={() => void access.refresh()}
            >
              Retry API access
            </Button>
          </p>
        ) : null}
        {!access.data ? (
          <output className="block text-sm">Loading API access…</output>
        ) : null}
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void access.generate(name);
          }}
        >
          <label htmlFor={inputId} className="flex flex-col gap-1.5 text-sm">
            Key name
            <Input
              id={inputId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={64}
              required
              autoComplete="off"
              placeholder="e.g. Scorekeeper"
              disabled={!access.data || access.busy || Boolean(access.issued)}
            />
          </label>
          <Button
            type="submit"
            disabled={
              !access.data ||
              access.busy ||
              !name.trim() ||
              active >= 10 ||
              Boolean(access.issued)
            }
          >
            Generate API key
          </Button>
          <p className="text-xs text-muted-foreground">
            {active}/10 active keys. Save each key before generating another.
          </p>
        </form>
        {access.issued ? (
          <section
            className="space-y-3 rounded-lg border border-border bg-muted p-3"
            aria-label="New API key"
          >
            <p className="text-sm font-medium">
              Save this key now. It will not be shown again after you dismiss it
              or leave this page.
            </p>
            <Input
              aria-label="Generated API key"
              readOnly
              value={access.issued.key}
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Expires {dateTime(access.issued.info.expiresAt)}. Store it in your
              password manager or integration’s secret store.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  void clipboard.copy("api-key", access.issued!.key)
                }
              >
                <Copy /> {clipboard.copied ? "Key copied" : "Copy API key"}
              </Button>
              <Button variant="ghost" onClick={access.dismiss}>
                I’ve saved the key
              </Button>
            </div>
            {clipboard.error ? (
              <p role="alert" className="text-sm">
                {clipboard.error} You can also select and copy the key above.
              </p>
            ) : null}
          </section>
        ) : null}
        {access.data ? (
          <ul
            className="max-h-80 divide-y divide-border overflow-y-auto"
            aria-label="API keys"
          >
            {!access.data.keys.length ? (
              <li className="py-3 text-sm text-muted-foreground">
                No API keys yet.
              </li>
            ) : null}
            {access.data.keys.map((key) => (
              <li key={key.id} className="space-y-2 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-all font-medium">
                    {key.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {key.revokedAt
                      ? "Revoked"
                      : key.expiresAt <= now
                        ? "Expired"
                        : "Active"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {dateTime(key.createdAt)} · Expires{" "}
                  {dateTime(key.expiresAt)}
                  <br />
                  Last used:{" "}
                  {key.lastUsedAt ? dateTime(key.lastUsedAt) : "Never"}
                </p>
                {!key.revokedAt && key.expiresAt > now ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={access.busy}
                    aria-label={`Revoke ${key.name}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Revoke ${key.name}? Integrations using it will stop working immediately.`,
                        )
                      )
                        void access.revoke(key.id);
                    }}
                  >
                    Revoke key
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <section
          aria-label="API activity alerts"
          className="space-y-3 border-t border-border pt-4"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="size-4" /> Activity alerts
          </h3>
          {access.data && !access.data.incidents.length ? (
            <p className="text-sm text-muted-foreground">
              No unusual API activity in the last 30 days.
            </p>
          ) : null}
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {access.data?.incidents.map((incident) => (
              <article
                key={incident.bucket}
                className="space-y-2 rounded-lg border border-border p-3 text-sm"
              >
                <p className="font-medium">
                  {incident.acknowledgedAt ? "Acknowledged" : "Unread"} ·{" "}
                  {incident.blockedCount
                    ? "Throttle exceeded — key revoked"
                    : "High write activity"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dateTime(incident.firstAt)} – {dateTime(incident.lastAt)}
                </p>
                <p>
                  {incident.createdCount} records created ·{" "}
                  {incident.blockedCount} requests blocked
                </p>
                <ul className="space-y-1">
                  {incident.sources.map((source) => (
                    <li
                      key={`${source.keyId}:${source.resource}`}
                      className="break-words text-xs"
                    >
                      {source.keyName} · {source.resource}:{" "}
                      {source.createdCount} created, {source.blockedCount}{" "}
                      blocked
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {!incident.acknowledgedAt ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={access.busy}
                      onClick={() => void access.acknowledge(incident.bucket)}
                    >
                      Acknowledge alert
                    </Button>
                  ) : null}
                  {Array.from(
                    new Set(incident.sources.map((source) => source.keyId)),
                  ).map((keyId) => {
                    const key = access.data?.keys.find(
                      (item) =>
                        item.id === keyId &&
                        !item.revokedAt &&
                        item.expiresAt > now,
                    );
                    return key ? (
                      <Button
                        key={keyId}
                        size="sm"
                        variant="outline"
                        disabled={access.busy}
                        onClick={() => {
                          if (window.confirm(`Revoke ${key.name}?`))
                            void access.revoke(keyId);
                        }}
                      >
                        Revoke {key.name}
                      </Button>
                    ) : null;
                  })}
                </div>
              </article>
            ))}
          </div>
          {access.data && access.data.incidents.length === 100 ? (
            <p className="text-xs text-muted-foreground">
              Showing up to 100 incidents, unread first. Acknowledge alerts to
              reveal older unread incidents.
            </p>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
};
