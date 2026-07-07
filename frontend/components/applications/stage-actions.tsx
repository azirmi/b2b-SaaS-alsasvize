"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  advanceStage,
  pauseApplication,
  resumeApplication,
} from "@/lib/actions/applications";
import type { ActionResult } from "@/lib/types";

interface StageActionsProps {
  id: string;
  /** Present when the viewer may advance the current stage. */
  advance?: { label: string; disabled?: boolean; hint?: string };
  canPause?: boolean;
  canResume?: boolean;
}

/**
 * Client leaf owning the workflow mutations for one application. Each action is a
 * server action; on success the dashboard subtree revalidates (and other staff
 * refresh via the `stageChanged` socket event), so this component holds no list
 * state — only transient pending/error UI.
 */
export function StageActions({
  id,
  advance,
  canPause,
  canResume,
}: StageActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (applicationId: string) => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (!result.ok) {
        setError(result.error ?? "Bir hata oluştu.");
      }
    });
  }

  if (!advance && !canPause && !canResume) {
    return (
      <p className="text-sm text-muted-foreground">
        Bu aşamada sizin için kullanılabilir bir iş akışı işlemi yok.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {advance ? (
          <Button
            size="sm"
            onClick={() => run(advanceStage)}
            disabled={pending || advance.disabled}
          >
            {advance.label}
            <ArrowRight aria-hidden />
          </Button>
        ) : null}
        {canPause ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => run(pauseApplication)}
            disabled={pending}
          >
            <Pause aria-hidden />
            Duraklat
          </Button>
        ) : null}
        {canResume ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => run(resumeApplication)}
            disabled={pending}
          >
            <Play aria-hidden />
            Devam Ettir
          </Button>
        ) : null}
      </div>

      {advance?.disabled && advance.hint ? (
        <p className="text-xs text-muted-foreground">{advance.hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
