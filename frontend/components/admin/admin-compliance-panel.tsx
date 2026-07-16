import Link from "next/link";

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
import type { AdminComplianceData } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return "—";
  }
  return value.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        <StatCard label="Claim Alınan" value={data.claimedCount} />
        <StatCard label="Kuyrukta Bekleyen" value={data.waitingCount} />
        <StatCard
          label="Ort. Bekleme Süresi"
          value={formatDuration(data.avgClaimWaitMs)}
          hint="Satıştan Evrak Claim anına kadar"
        />
        <StatCard
          label="SLA Eşiği"
          value={`${data.slaHours} saat`}
          hint={`${data.breachedCount} kayıt eşiği aştı`}
        />
      </div>

      <section className="rounded-lg border border-border/40 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
          <h2 className="text-sm font-medium">Performans & Uyum</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {data.rows.length} kayıt
          </span>
        </div>

        {data.rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Satıştan evrak kuyruğuna geçen bir dosya bulunamadı.
          </div>
        ) : (
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Başvuru
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Süreç Durumu
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Satış → Evrak Kuyruk
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Evrak Claim
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Bekleme Süresi
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Evrak Personeli
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
                        {row.isSlaBreached ? "SLA Aşıldı" : "Uygun"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(row.salesToDocAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(row.docClaimAt)}
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
                    {row.docClaimedBy ?? row.docAssignee ?? "—"}
                    <div className="text-xs text-muted-foreground">
                      {row.status === "CLAIMED" ? "Claim alındı" : "Claim bekleniyor"}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
