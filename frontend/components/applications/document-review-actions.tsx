"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approveDocument, rejectDocument } from "@/lib/actions/documents";

/**
 * DOC review controls for one document: Approve, or Reject with an inline reason.
 * Each action is a server action that revalidates the dashboard subtree, so the
 * document's status flips and the "Send to Secretary" gate re-evaluates.
 */
export function DocumentReviewActions({
  documentId,
  isApproved,
  isRejected,
}: {
  documentId: string;
  isApproved: boolean;
  isRejected: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function onApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveDocument(documentId);
      if (!result.ok) setError(result.error ?? "Approval failed.");
    });
  }

  function onReject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A rejection reason is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rejectDocument(documentId, trimmed);
      if (!result.ok) {
        setError(result.error ?? "Rejection failed.");
        return;
      }
      setRejecting(false);
      setReason("");
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      {rejecting ? (
        <div className="flex flex-col items-end gap-2">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (e.g. blurry scan)"
            maxLength={300}
            autoFocus
            className="h-8 w-52"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRejecting(false);
                setReason("");
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={onReject} disabled={pending}>
              {pending ? "Rejecting…" : "Confirm reject"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {!isApproved ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onApprove}
              disabled={pending}
            >
              <Check aria-hidden />
              {pending ? "Approving…" : "Approve"}
            </Button>
          ) : null}
          {!isRejected ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRejecting(true);
                setError(null);
              }}
              disabled={pending}
            >
              <X aria-hidden />
              Reject
            </Button>
          ) : null}
        </div>
      )}
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}
