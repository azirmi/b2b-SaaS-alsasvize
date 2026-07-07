"use client";

import { useRouter } from "next/navigation";

import { useSocket } from "@/hooks/use-socket";
import { cn } from "@/lib/utils";

/**
 * Client leaf that owns the single dashboard socket. Workflow events are
 * authoritative (emitted post-commit), so each one triggers `router.refresh()`
 * to re-fetch the server-rendered data. Renders a small live indicator.
 */
export function RealtimeBridge({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();

  const { connected } = useSocket(
    {
      applicationClaimed: () => router.refresh(),
      stageChanged: () => router.refresh(),
      slaBreached: () => router.refresh(),
    },
    { enabled },
  );

  if (!enabled) {
    return null;
  }

  return (
    <span
      className="hidden items-center gap-1.5 sm:flex"
      title={connected ? "Canlı güncelleme bağlantısı aktif" : "Yeniden bağlanıyor…"}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          connected ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
      />
      <span className="text-xs text-muted-foreground">
        {connected ? "Canlı" : "Çevrimdışı"}
      </span>
    </span>
  );
}
