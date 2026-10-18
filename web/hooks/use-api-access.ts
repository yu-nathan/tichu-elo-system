"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  acknowledgeApiIncident,
  fetchApiAccess,
  generateApiKey,
  revokeApiKey,
} from "@/lib/api-access-client";
import type { ApiAccessData, ApiKeyInfo } from "@/lib/external-api-types";

export const useApiAccess = (enabled: boolean) => {
  const [observedAt, setObservedAt] = useState(0);
  const [data, setData] = useState<ApiAccessData | null>(null);
  const [issued, setIssued] = useState<{
    key: string;
    info: ApiKeyInfo;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const requestVersion = useRef(0);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = ++requestVersion.current;
    try {
      const next = await fetchApiAccess(signal);
      if (!signal?.aborted && version === requestVersion.current) {
        setData(next);
        setObservedAt(Date.now());
        setError("");
      }
    } catch (caught) {
      if (!signal?.aborted && version === requestVersion.current)
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load API access.",
        );
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const update = () => {
      if (document.visibilityState === "visible" && !pending.current)
        void refresh(controller.signal);
    };
    update();
    const timer = setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [enabled, refresh]);

  const mutate = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    ++requestVersion.current;
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The operation failed.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    data,
    observedAt,
    issued,
    error,
    busy,
    refresh,
    dismiss: () => setIssued(null),
    generate: (name: string) =>
      mutate(async () => {
        setIssued(await generateApiKey(name));
      }),
    revoke: (id: string) =>
      mutate(async () => {
        await revokeApiKey(id);
        setIssued((current) => (current?.info.id === id ? null : current));
      }),
    acknowledge: (bucket: number) =>
      mutate(async () => {
        await acknowledgeApiIncident(bucket);
      }),
  };
};
