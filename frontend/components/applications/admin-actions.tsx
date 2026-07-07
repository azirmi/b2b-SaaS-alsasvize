"use client";

import { useState, useTransition } from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  forceCancelApplication,
  forceStage,
  reassignApplication,
} from "@/lib/actions/applications";
import { VisaStage } from "@/lib/enums";
import { STAGE_LABEL } from "@/lib/status";
import type { ActionResult, StaffOption } from "@/lib/types";

const STAGES = Object.values(VisaStage);

/**
 * Admin God-Mode overrides for one application: force-reassign the department
 * slot, force any stage transition (bypassing gates), or force-cancel. Each is a
 * server action that revalidates the dashboard subtree; every override is audited.
 */
export function AdminActions({
  applicationId,
  currentStage,
  staff,
}: {
  applicationId: string;
  currentStage: VisaStage;
  staff: StaffOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [staffId, setStaffId] = useState("");
  const [stage, setStage] = useState<VisaStage>(currentStage);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function run(action: () => Promise<ActionResult>, success: string) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setNote(success);
      } else {
        setError(result.error ?? "İşlem başarısız.");
      }
    });
  }

  function onReassign() {
    const option = staff.find((s) => s.staffId === staffId);
    if (!option) {
      setError("Önce bir personel seçin.");
      return;
    }
    run(
      () => reassignApplication(applicationId, option.department, option.staffId),
      `${option.fullName} kişisine yeniden atandı.`,
    );
  }

  return (
    <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-medium">Yönetici İşlemleri</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Yönetici override işlemleri. Tüm adımlar denetim kaydına yazılır.
      </p>
      <Separator className="my-4" />

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="reassign-staff">Personele yeniden ata</Label>
          <div className="flex gap-2">
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger id="reassign-staff" className="w-full">
                <SelectValue placeholder="Personel seçin" />
              </SelectTrigger>
              <SelectContent>
                {staff.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Uygun personel yok
                  </div>
                ) : (
                  staff.map((option) => (
                    <SelectItem key={option.staffId} value={option.staffId}>
                      {option.fullName} · {option.department}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={onReassign}
              disabled={pending || !staffId}
            >
              Yeniden Ata
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="force-stage">Aşamayı zorla değiştir</Label>
          <div className="flex gap-2">
            <Select value={stage} onValueChange={(value) => setStage(value as VisaStage)}>
              <SelectTrigger id="force-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STAGE_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                run(
                  () => forceStage(applicationId, stage),
                  `Aşama ${STAGE_LABEL[stage]} olarak ayarlandı.`,
                )
              }
              disabled={pending || stage === currentStage}
            >
              Uygula
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Başvuruyu iptal et</Label>
          {confirmingCancel ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingCancel(false)}
                disabled={pending}
              >
                Vazgeç
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  run(
                    () => forceCancelApplication(applicationId),
                    "Başvuru iptal edildi.",
                  )
                }
                disabled={pending}
              >
                {pending ? "İptal ediliyor…" : "İptali Onayla"}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setConfirmingCancel(true);
                setError(null);
                setNote(null);
              }}
              disabled={pending || currentStage === VisaStage.CANCELLED}
            >
              Zorla İptal
            </Button>
          )}
        </div>

        {error ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        {note ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">{note}</p>
        ) : null}
      </div>
    </section>
  );
}
