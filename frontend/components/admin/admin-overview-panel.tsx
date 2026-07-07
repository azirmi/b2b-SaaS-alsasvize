"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

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

function buildAllApplicationsPath(q: string, staffId: string | null): string {
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
    ? staffNameMap.get(selectedStaffId) ?? "Unknown staff"
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
          setLoadError("Could not refresh applications. Please try again.");
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

  const hasAnyFilter = Boolean(search.trim() || selectedStaffId);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="All applications" value={stats.totalApplications} />
        <StatCard
          label="In process"
          value={inProcess}
          hint="Sales and DOC work in progress"
        />
        <StatCard label="Completed" value={stats.completedCount} />
        <StatCard
          label="Avg processing"
          value={formatDuration(stats.avgProcessingMs)}
          hint={`${stats.completedCount} completed`}
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
            <h2 className="text-sm font-medium">All applications</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {isLoading ? "Updating..." : `${applications.length} shown`}
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
                placeholder="Search by customer, staff, or application ID"
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
                Clear filter
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
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>

          {selectedStaffName ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Filtered by staff: <span className="font-medium">{selectedStaffName}</span>
            </p>
          ) : null}

          {loadError ? (
            <p className="mt-2 text-xs text-muted-foreground">{loadError}</p>
          ) : null}
        </div>

        {applications.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No applications match your current filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Applicant
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Stage
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Handler
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">
                  In system
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => {
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
