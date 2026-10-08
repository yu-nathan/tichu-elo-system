"use client";

import { Popover } from "@base-ui/react/popover";
import { CircleHelp } from "lucide-react";
import { useLayoutEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const InfoTooltip = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const tooltipId = useId();
  useLayoutEffect(() => {
    if (!open) return;
    // Dismiss this help layer before Escape reaches the surrounding dialog.
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
    };
    document.addEventListener("keydown", dismiss, true);
    return () => document.removeEventListener("keydown", dismiss, true);
  }, [open]);
  return (
    <Popover.Root open={open} onOpenChange={setOpen} triggerId={triggerId}>
      <Popover.Trigger
        id={triggerId}
        render={<Button variant="ghost" size="icon" />}
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        delay={150}
        openOnHover
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
        className="text-muted-foreground"
      >
        <CircleHelp aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50"
        >
          <Popover.Popup
            id={tooltipId}
            role="tooltip"
            initialFocus={false}
            finalFocus={false}
            className="max-w-72 rounded-lg border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-lg"
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
