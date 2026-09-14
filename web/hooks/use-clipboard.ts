"use client";
import { useEffect, useRef, useState } from "react";

export const useClipboard = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const attempt = useRef(0);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      attempt.current += 1;
    },
    [],
  );

  const copy = async (label: string, value: string) => {
    const current = ++attempt.current;
    clearTimeout(timer.current);
    setCopied(null);
    setError("");
    try {
      await navigator.clipboard.writeText(value);
      if (current !== attempt.current) return;
      setCopied(label);
      timer.current = setTimeout(() => setCopied(null), 1600);
    } catch {
      if (current === attempt.current)
        setError("Could not copy. Allow clipboard access and try again.");
    }
  };
  return { copied, error, copy };
};
