"use client";

import { useEffect, useState } from "react";

// Atlas cells share one download/decode, including the heading illustration.
const decodedImages = new Map<string, Promise<void>>();

const decodeImage = (source: string) => {
  const cached = decodedImages.get(source);
  if (cached) return cached;
  const image = new Image();
  image.fetchPriority = "low";
  image.src = source;
  const pending = image.decode().catch((error: unknown) => {
    decodedImages.delete(source);
    throw error;
  });
  decodedImages.set(source, pending);
  return pending;
};

export const useDecodedImage = (source: string, mobileSource?: string) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [decodedSource, setDecodedSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let activeSource: string | null = null;
    const media = window.matchMedia("(width < 640px)");
    const update = () => {
      const next = mobileSource && media.matches ? mobileSource : source;
      if (next === activeSource) return;
      activeSource = next;
      cancelAnimationFrame(frame);
      setSelectedSource(next);
      void decodeImage(next).then(
        () => {
          if (cancelled || activeSource !== next) return;
          // Paint the reserved, transparent frame before starting the reveal,
          // even when the asset is already in the browser cache.
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
              if (!cancelled && activeSource === next) setDecodedSource(next);
            });
          });
        },
        () => {
          // A failed decorative asset stays hidden; the dashboard remains usable.
        },
      );
    };
    // Choose before creating Image: a phone never speculatively downloads the
    // desktop atlas. Both SSR and the first client render stay transparent.
    update();
    if (mobileSource) media.addEventListener("change", update);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      media.removeEventListener("change", update);
    };
  }, [source, mobileSource]);

  const current = selectedSource === source || selectedSource === mobileSource;
  return {
    source: current && selectedSource ? selectedSource : source,
    ready: Boolean(
      current && selectedSource && decodedSource === selectedSource,
    ),
  };
};
