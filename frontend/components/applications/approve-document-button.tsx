"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { approveDocument } from "@/lib/actions/documents";

/**
 * Client leaf that approves a single uploaded document (DOC staff / admin). On
 * success the dashboard subtree revalidates, flipping this document to
 * "Approved" and clearing the stage-advance gate.
 */
export function ApproveDocumentButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveDocument(id);
      if (!result.ok) {
        setError(result.error ?? "Approval failed.");
      }
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
      <Button size="sm" variant="outline" onClick={onApprove} disabled={pending}>
        <Check aria-hidden />
        {pending ? "Approving…" : "Approve"}
      </Button>
    </div>
  );
}
