"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

/**
 * App-wide toast surface. Neutral toasts inherit the design tokens (monochrome
 * dominance); `richColors` reserves green/red strictly for semantic
 * success/error status. Mounted once in the root layout.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="system"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-sm",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
