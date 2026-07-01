import { redirect } from "next/navigation";

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
import type { VisaApplicationSummary } from "@/lib/types";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
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

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const isStaff = session.role !== Role.CUSTOMER;

  let applications: VisaApplicationSummary[] = [];
  let loadError = false;
  try {
    applications = await serverApi.get<VisaApplicationSummary[]>(
      isStaff ? "/applications/pool" : "/applications/mine",
    );
  } catch {
    loadError = true;
  }

  const stats = {
    total: applications.length,
    inProcess: applications.filter((a) => a.currentStage.endsWith("_PROCESS"))
      .length,
    inQueue: applications.filter((a) => a.currentStage.endsWith("_POOL")).length,
    completed: applications.filter((a) => a.currentStage === VisaStage.COMPLETED)
      .length,
  };
  const recent = applications.slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {isStaff
            ? "Applications waiting in and moving through your department."
            : "The status of every visa application you have submitted."}
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Unable to load applications right now. The workspace will refresh
          automatically once the service is reachable.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={isStaff ? "In department" : "Applications"} value={stats.total} />
            <StatCard label="In process" value={stats.inProcess} />
            <StatCard label="In queue" value={stats.inQueue} />
            <StatCard label="Completed" value={stats.completed} />
          </div>

          <section className="rounded-lg border border-border/40 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
              <h2 className="text-sm font-medium">
                {isStaff ? "Longest waiting" : "Recent applications"}
              </h2>
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
                      Applicant
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Stage
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Waiting
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((application) => (
                    <TableRow key={application.id} className="border-border/40">
                      <TableCell>
                        <div className="font-medium">
                          {application.customer.fullName}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {application.id.slice(0, 8)}
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
