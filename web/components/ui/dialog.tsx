"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export const DialogContent = ({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
    <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <DialogPrimitive.Popup
        className={cn(
          "relative max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-5 text-foreground shadow-2xl outline-none sm:p-7",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Close
          render={<Button variant="ghost" size="icon" />}
          className="absolute top-3 right-3"
          aria-label="Close profile"
        >
          <X />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Viewport>
  </DialogPrimitive.Portal>
);
