"use client";
import { useRef, useState } from "react";
import { fetchAppData } from "@/lib/api-client";
import { errorMessage, mutateAndRefresh } from "@/lib/mutation";
import type { AppData } from "@/lib/models";

export const useAdminData = (initialData: AppData) => {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const inFlight = useRef(false);

  const mutate = async (action: () => Promise<void>) => {
    if (inFlight.current || warning) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await mutateAndRefresh(action, fetchAppData);
      if (!result.saved) setError(result.error);
      else {
        if (result.data) setData(result.data);
        setWarning(result.warning ?? "");
      }
      return result.saved;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      setData(await fetchAppData());
      setWarning("");
    } catch (error) {
      setError(errorMessage(error, "Could not refresh the data."));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return { data, busy, error, warning, setError, mutate, refresh };
};
