import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { StageBadge } from "@/components/stage-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession, serverApi } from "@/lib/api.server";
import { Role, VisaStage } from "@/lib/enums";
import { timeAgo } from "@/lib/format";
import type { AssignedApplication, VisaApplicationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const TERMINAL = new Set<VisaStage>([
  VisaStage.COMPLETED,
  VisaStage.CANCELLED,
]);

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </>
  );
  const base = "block rounded-lg border border-border/40 bg-card p-4 shadow-sm";
  return href ? (
    <Link
      href={href}
      className={cn(
        base,
        "transition-colors hover:border-border hover:bg-accent/40",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // ── Customer overview ───────────────────────────────────────────────
  if (session.role === Role.CUSTOMER) {
    let applications: VisaApplicationSummary[] = [];
    let loadError = false;
    try {
      applications = await serverApi.get<VisaApplicationSummary[]>(
        "/applications/mine",
      );
    } catch {
      loadError = true;
    }

    const stats = {
      total: applications.length,
      active: applications.filter((a) => !TERMINAL.has(a.currentStage)).length,
      completed: applications.filter(
        (a) => a.currentStage === VisaStage.COMPLETED,
      ).length,
    };
    const recent = applications.slice(0, 8);

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            The status of every visa application you have submitted.
          </p>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
            Unable to load your applications right now. This page refreshes
            automatically once the service is reachable.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Applications" value={stats.total} />
              <StatCard label="Active" value={stats.active} />
              <StatCard label="Completed" value={stats.completed} />
            </div>

            <section className="rounded-lg border border-border/40 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
                <h2 className="text-sm font-medium">Recent applications</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {recent.length} of {applications.length}
                </span>
              </div>
              {recent.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No applications to show yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        Reference
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        Stage
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        Updated
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((application) => (
                      <TableRow
                        key={application.id}
                        className="border-border/40"
                      >
                        <TableCell>
                          <Link
                            href={`/dashboard/applications/${application.id}`}
                            className="font-mono text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                          >
                            {application.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StageBadge stage={application.currentStage} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {timeAgo(application.stageUpdatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  // ── Staff / admin overview ────────────────────────────────────────
  const isAdmin = session.role === Role.ADMIN;
  let queue: VisaApplicationSummary[] = [];
  let assigned: AssignedApplication[] = [];
  let loadError = false;
  try {
    [queue, assigned] = await Promise.all([
      serverApi.get<VisaApplicationSummary[]>("/applications/pool"),
      serverApi.get<AssignedApplication[]>("/applications/assigned"),
    ]);
  } catch {
    loadError = true;
  }

  const queueCount = isAdmin
    ? queue.filter((a) => a.currentStage.endsWith("_POOL")).length
    : queue.length;
  const recent = assigned.slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {isAdmin
            ? "Live workload across every department."
            : "Your department queue and the work you are actively processing."}
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Unable to load the workspace right now. This page refreshes
          automatically once the service is reachable.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label={isAdmin ? "In pools" : "In your queue"}
              value={queueCount}
              hint="Waiting to be claimed"
              href="/dashboard/pool"
            />
            <StatCard
              label={isAdmin ? "In process" : "Assigned to you"}
              value={assigned.length}
              hint="Actively being worked"
              href="/dashboard/workspace"
            />
          </div>

          <section className="rounded-lg border border-border/40 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
              <h2 className="text-sm font-medium">
                {isAdmin ? "In process" : "Assigned to you"}
              </h2>
              <Link
                href="/dashboard/workspace"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                Nothing assigned yet. Claim work from the{" "}
                <Link
                  href="/dashboard/pool"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  work pool
                </Link>
                .
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
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      In stage
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((application) => (
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
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {timeAgo(application.stageUpdatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
