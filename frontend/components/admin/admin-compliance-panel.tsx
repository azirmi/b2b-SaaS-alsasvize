import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

import { StageBadge } from "@/components/stage-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDuration } from "@/lib/format";
import type { AdminComplianceData, AdminComplianceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return "—";
  }
  return format(value, "dd MMMM yyyy HH:mm", { locale: tr });
}

function assignmentStatusText(status: AdminComplianceRow["status"]): string {
  return status === "CLAIMED"
    ? "Dosya Atandı"
    : "Personel Ataması Bekleniyor";
}

function assigneeDisplay(row: AdminComplianceRow): string {
  return row.docClaimedBy ?? row.docAssignee ?? "Henüz Atanmadı";
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AdminCompliancePanel({ data }: { data: AdminComplianceData }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Aktarılan Dosya" value={data.totalTransferred} />
        <StatCard label="Dosya Atanan" value={data.claimedCount} />
        <StatCard label="Atama Bekleyen" value={data.waitingCount} />
        <StatCard
          label="Ort. Bekleme Süresi"
          value={formatDuration(data.avgClaimWaitMs)}
          hint="Satıştan evrak sürecine aktarımdan dosya atama anına kadar"
        />
        <StatCard
          label="Hedef Süre Eşiği"
          value={`${data.slaHours} saat`}
          hint={`${data.breachedCount} başvuru hedef süreyi aştı`}
        />
      </div>

      <section className="rounded-lg border border-border/40 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-3.5 sm:px-5">
          <h2 className="text-sm font-medium">Operasyon Performansı</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            Toplam {data.rows.length} Başvuru
          </span>
        </div>

        {data.rows.length === 0 ? (
          <div className="px-3 py-12 text-center text-sm text-muted-foreground sm:px-5">
            Satıştan evrak kuyruğuna geçen bir dosya bulunamadı.
          </div>
        ) : (
          <>
            <div className="space-y-3 px-3 py-4 md:hidden">
              {data.rows.map((row) => (
                <article
                  key={row.applicationId}
                  className="rounded-lg border border-border/40 bg-background p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Danışan
                      </p>
                      <Link
                        href={`/dashboard/applications/${row.applicationId}`}
                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {row.customerName}
                      </Link>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md text-[11px]",
                        row.isSlaBreached
                          ? "border-red-300/70 text-red-600 dark:border-red-700/60 dark:text-red-400"
                          : "border-emerald-300/70 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-400",
                      )}
                    >
                      {row.isSlaBreached ? "Hedef Süre Aşıldı" : "Uygun"}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Süreç Durumu
                      </p>
                      <StageBadge stage={row.currentStage} />
                    </div>

                    <div className="space-y-1 text-right">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        İşlem Bekleme Süresi
                      </p>
                      <span
                        className={cn(
                          "font-mono text-xs tabular-nums",
                          row.isSlaBreached
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatDuration(row.waitMs)}
                      </span>
                    </div>
                  </div>

                  <dl className="mt-3 space-y-2 border-t border-border/30 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Evrak Sürecine Aktarım
                      </dt>
                      <dd className="font-mono text-xs text-muted-foreground">
                        {formatDateTime(row.salesToDocAt)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Dosya Atama Durumu
                      </dt>
                      <dd className="text-xs text-muted-foreground">
                        {assignmentStatusText(row.status)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Sorumlu Dosya Asistanı
                      </dt>
                      <dd className="text-right text-sm">
                        {assigneeDisplay(row)}
                        <p className="text-xs text-muted-foreground">
                          {row.status === "CLAIMED"
                            ? "Dosyayı Üstlenen Personel"
                            : "Personel Ataması Bekleniyor"}
                        </p>
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden md:block">
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Danışan
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Süreç Durumu
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Evrak Sürecine Aktarım
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Dosya Atama Durumu
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      İşlem Bekleme Süresi
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Sorumlu Dosya Asistanı
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.applicationId} className="border-border/40">
                      <TableCell>
                        <Link
                          href={`/dashboard/applications/${row.applicationId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {row.customerName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <StageBadge stage={row.currentStage} />
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md text-[11px]",
                              row.isSlaBreached
                                ? "border-red-300/70 text-red-600 dark:border-red-700/60 dark:text-red-400"
                                : "border-emerald-300/70 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-400",
                            )}
                          >
                            {row.isSlaBreached ? "Hedef Süre Aşıldı" : "Uygun"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDateTime(row.salesToDocAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {assignmentStatusText(row.status)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "font-mono text-xs tabular-nums",
                            row.isSlaBreached
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatDuration(row.waitMs)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {assigneeDisplay(row)}
                        <div className="text-xs text-muted-foreground">
                          {row.status === "CLAIMED"
                            ? "Dosyayı Üstlenen Personel"
                            : "Personel Ataması Bekleniyor"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
