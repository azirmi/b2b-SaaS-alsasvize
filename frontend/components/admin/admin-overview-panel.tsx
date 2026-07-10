"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";

import { AdminStatsCharts } from "@/components/admin/admin-stats-charts";
import { StageBadge } from "@/components/stage-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { VisaStage } from "@/lib/enums";
import { formatDuration, timeAgo } from "@/lib/format";
import type { AdminApplicationRow, AdminStats } from "@/lib/types";

type HeaderSortKey = "applicant" | "stage" | "assigned" | "system";
type HeaderSortDirection = "asc" | "desc";

type HeaderSortState =
  | { key: HeaderSortKey; direction: HeaderSortDirection }
  | null;

const STAGE_ORDER: Record<VisaStage, number> = {
  [VisaStage.SALES_POOL]: 1,
  [VisaStage.SALES_PROCESS]: 2,
  [VisaStage.DOC_POOL]: 3,
  [VisaStage.DOC_PROCESS]: 4,
  [VisaStage.SEC_POOL]: 5,
  [VisaStage.SEC_PROCESS]: 6,
  [VisaStage.COMPLETED]: 7,
  [VisaStage.PAUSED]: 8,
  [VisaStage.CANCELLED]: 9,
};

function stageHandler(app: AdminApplicationRow): string | null {
  switch (app.currentStage) {
    case VisaStage.SALES_PROCESS:
      return app.assignedSales?.user.fullName ?? null;
    case VisaStage.DOC_PROCESS:
      return app.assignedDoc?.user.fullName ?? null;
    case VisaStage.SEC_PROCESS:
    case VisaStage.COMPLETED:
      return app.assignedSec?.user.fullName ?? null;
    default:
      return null;
  }
}

function buildAllApplicationsPath(
  q: string,
  staffId: string | null,
): string {
  const params = new URLSearchParams();
  const query = q.trim();

  if (query) {
    params.set("q", query);
  }
  if (staffId) {
    params.set("staffId", staffId);
  }

  const encoded = params.toString();
  return encoded ? `/applications/all?${encoded}` : "/applications/all";
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
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

export function AdminOverviewPanel({
  stats,
  initialApplications,
}: {
  stats: AdminStats;
  initialApplications: AdminApplicationRow[];
}) {
  const [search, setSearch] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [headerSort, setHeaderSort] = useState<HeaderSortState>(null);
  const [applications, setApplications] =
    useState<AdminApplicationRow[]>(initialApplications);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasMountedRef = useRef(false);

  const staffNameMap = useMemo(
    () =>
      new Map(
        [...stats.salesProductivity, ...stats.docProductivity].map((staff) => [
          staff.staffId,
          staff.fullName,
        ]),
      ),
    [stats.salesProductivity, stats.docProductivity],
  );

  const selectedStaffName = selectedStaffId
    ? staffNameMap.get(selectedStaffId) ?? "Bilinmeyen personel"
    : null;

  const inProcess = [...stats.salesPipeline, ...stats.docPipeline]
    .filter((row) => row.stage.endsWith("_PROCESS"))
    .reduce((sum, row) => sum + row.count, 0);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const path = buildAllApplicationsPath(search, selectedStaffId);
        const next = await api.get<AdminApplicationRow[]>(path, {
          signal: controller.signal,
        });
        setApplications(next);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setLoadError("Başvurular yenilenemedi. Lütfen tekrar deneyin.");
        }
      } finally {
        setIsLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [search, selectedStaffId]);

  const collator = useMemo(
    () =>
      new Intl.Collator("tr", {
        sensitivity: "base",
      }),
    [],
  );

  const sortedApplications = useMemo(() => {
    if (!headerSort) {
      return applications;
    }

    const factor = headerSort.direction === "asc" ? 1 : -1;
    const rows = [...applications];
    rows.sort((a, b) => {
      let compare = 0;

      switch (headerSort.key) {
        case "applicant": {
          compare = collator.compare(a.customer.fullName, b.customer.fullName);
          break;
        }
        case "stage": {
          compare = STAGE_ORDER[a.currentStage] - STAGE_ORDER[b.currentStage];
          if (compare === 0) {
            compare = collator.compare(a.customer.fullName, b.customer.fullName);
          }
          break;
        }
        case "assigned": {
          const aName = stageHandler(a) ?? "";
          const bName = stageHandler(b) ?? "";
          compare = collator.compare(aName, bName);
          break;
        }
        case "system": {
          compare =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        }
      }

      return compare * factor;
    });

    return rows;
  }, [applications, collator, headerSort]);

  function toggleHeaderSort(key: HeaderSortKey) {
    setHeaderSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  }

  function renderHeaderButton({
    label,
    columnKey,
    align = "left",
  }: {
    label: string;
    columnKey: HeaderSortKey;
    align?: "left" | "right";
  }) {
    const active = headerSort?.key === columnKey;
    const icon = !active ? (
      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
    ) : headerSort.direction === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
    );

    return (
      <button
        type="button"
        onClick={() => toggleHeaderSort(columnKey)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        } ${align === "right" ? "ml-auto" : ""}`}
        aria-label={`${label} sütununu sırala`}
      >
        <span>{label}</span>
        {icon}
      </button>
    );
  }

  const hasAnyFilter = Boolean(
    search.trim() ||
      selectedStaffId ||
      headerSort,
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tüm başvurular" value={stats.totalApplications} />
        <StatCard
          label="İşlemde"
          value={inProcess}
          hint="Satış ve Evrak biriminde işlemde"
        />
        <StatCard label="Tamamlanan" value={stats.completedCount} />
        <StatCard
          label="Ort. işlem süresi"
          value={formatDuration(stats.avgProcessingMs)}
          hint={`${stats.completedCount} tamamlanan`}
        />
      </div>

      <AdminStatsCharts
        salesPipeline={stats.salesPipeline}
        salesProductivity={stats.salesProductivity}
        docPipeline={stats.docPipeline}
        docProductivity={stats.docProductivity}
        selectedStaffId={selectedStaffId}
        onStaffSelect={(staffId) => {
          setSelectedStaffId((current) =>
            current === staffId ? null : staffId,
          );
        }}
      />

      <section className="rounded-lg border border-border/40 bg-card shadow-sm">
        <div className="border-b border-border/40 px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">Tüm Başvurular</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {isLoading ? "Güncelleniyor..." : `${applications.length} kayıt`}
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-lg">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Müşteri, personel veya başvuru kimliği ile ara"
                className="pl-8"
              />
            </div>

            {selectedStaffId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedStaffId(null)}
              >
                Filtreyi temizle
              </Button>
            ) : null}

            {hasAnyFilter ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedStaffId(null);
                  setHeaderSort(null);
                }}
              >
                Sıfırla
              </Button>
            ) : null}
          </div>

          {selectedStaffName ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Personel filtresi: <span className="font-medium">{selectedStaffName}</span>
            </p>
          ) : null}

          {loadError ? (
            <p className="mt-2 text-xs text-muted-foreground">{loadError}</p>
          ) : null}
        </div>

        {applications.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Mevcut filtreyle eşleşen başvuru bulunamadı.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {renderHeaderButton({ label: "Başvuran", columnKey: "applicant" })}
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {renderHeaderButton({ label: "Aşama", columnKey: "stage" })}
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {renderHeaderButton({ label: "Sorumlu", columnKey: "assigned" })}
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">
                  {renderHeaderButton({
                    label: "Sistemde",
                    columnKey: "system",
                    align: "right",
                  })}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedApplications.map((application) => {
                const handler = stageHandler(application);
                return (
                  <TableRow key={application.id} className="border-border/40">
                    <TableCell>
                      <Link
                        href={`/dashboard/applications/${application.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {application.customer.fullName}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">
                        {application.customer.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={application.currentStage} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {handler ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {timeAgo(application.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
