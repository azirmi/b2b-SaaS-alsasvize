"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteDocument } from "@/lib/actions/documents";

/**
 * Two-step delete for a customer document. First click asks to confirm (delete is
 * destructive); confirming calls the server action, which revalidates so the file
 * drops from the list and the backend also removes the stored object.
 */
export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteDocument(documentId);
      if (!result.ok) {
        setError(result.error ?? "Silme işlemi başarısız.");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          İptal
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDelete}
          disabled={pending}
        >
          {pending ? "Siliniyor…" : "Sil"}
        </Button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => {
          setConfirming(true);
          setError(null);
        }}
        disabled={pending}
        aria-label="Belgeyi sil"
        className="text-muted-foreground hover:text-foreground"
      >
        <Trash2 aria-hidden />
      </Button>
    </span>
  );
}
