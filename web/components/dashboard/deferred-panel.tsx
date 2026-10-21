"use client";
import { useEffect, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { PanelPlaceholder } from "./panel-placeholder";

export const DeferredPanel = <P extends object>({
  enabled,
  load,
  title,
  componentProps,
}: {
  enabled: boolean;
  load: () => Promise<ComponentType<P>>;
  title: string;
  componentProps: P;
}) => {
  const [Component, setComponent] = useState<ComponentType<P> | null>(null);
  const [error, setError] = useState(false);
  // Once requested, retain the component and its state across tabs and resizing.
  const [started, setStarted] = useState(enabled);
  if (enabled && !started) setStarted(true);
  useEffect(() => {
    if (!started) return;
    let mounted = true;
    void load()
      .then((next) => {
        if (mounted) setComponent(() => next);
      })
      .catch(() => {
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
    };
  }, [started, load]);
  if (Component) return <Component {...componentProps} />;
  if (error)
    return (
      <div role="alert" className="rounded-xl bg-card p-4">
        <p>Could not load {title.toLowerCase()}.</p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Reload page
        </Button>
      </div>
    );
  return <PanelPlaceholder title={title} />;
};
