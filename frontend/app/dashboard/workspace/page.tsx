import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Paperclip } from "lucide-react";

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
import { Role } from "@/lib/enums";
import { timeAgo } from "@/lib/format";
import type { AssignedApplication } from "@/lib/types";

export default async function WorkspacePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role === Role.CUSTOMER) {
    redirect("/dashboard");
  }
  const isAdmin = session.role === Role.ADMIN;

  let applications: AssignedApplication[] = [];
  let loadError = false;
  try {
    applications = await serverApi.get<AssignedApplication[]>(
      "/applications/assigned",
    );
  } catch {
    loadError = true;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My workspace</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isAdmin
              ? "Every application currently being worked across all departments."
              : "Applications you have claimed and are actively processing."}
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {applications.length} active
        </span>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Unable to load your workspace right now. It will refresh automatically
          once the service is reachable.
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card px-5 py-16 text-center text-sm text-muted-foreground shadow-sm">
          Nothing assigned to you yet. Claim work from the{" "}
          <Link
            href="/dashboard/pool"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            work pool
          </Link>
          .
        </div>
      ) : (
        <section className="rounded-lg border border-border/40 bg-card shadow-sm">
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
                  Files
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">
                  In stage
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => (
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
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" aria-hidden />
                      <span className="tabular-nums">
                        {application._count.documents}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {timeAgo(application.stageUpdatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/applications/${application.id}`}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
