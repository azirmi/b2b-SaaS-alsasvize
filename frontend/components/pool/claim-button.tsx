"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { claimApplication } from "@/lib/actions/applications";

/**
 * Client leaf that claims a single pooled application. The server action
 * revalidates the dashboard subtree, so on success this row drops from the queue
 * without a reload; failures (e.g. a lost claim race) surface inline and the row
 * is restored on the next refresh.
 */
export function ClaimButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClaim() {
    setError(null);
    startTransition(async () => {
      const result = await claimApplication(id);
      if (!result.ok) {
        setError(result.error ?? "Başvuru alınamadı.");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
      <Button size="sm" onClick={onClaim} disabled={pending}>
        {pending ? "Alınıyor…" : "Al"}
      </Button>
    </div>
  );
}
