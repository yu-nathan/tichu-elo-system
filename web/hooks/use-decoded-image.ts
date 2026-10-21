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

export const useDecodedImage = (source: string) => {
  const [decodedSource, setDecodedSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    void decodeImage(source).then(
      () => {
        if (cancelled) return;
        // Paint the reserved, transparent frame before starting the reveal,
        // even when the asset is already in the browser cache.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => setDecodedSource(source));
        });
      },
      () => {
        // A failed decorative asset stays hidden; the dashboard remains usable.
      },
    );
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [source]);

  return decodedSource === source;
};
