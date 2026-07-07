import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AdminOverviewPanel } from "@/components/admin/admin-overview-panel";
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
import type {
  AdminApplicationRow,
  AdminStats,
  AssignedApplication,
  VisaApplicationSummary,
} from "@/lib/types";
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
  value: number | string;
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
          <h1 className="text-2xl font-semibold tracking-tight">Genel Bakış</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Gönderdiğiniz tüm vize başvurularının güncel durumu.
          </p>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
            Başvurularınız şu anda yüklenemiyor. Hizmet tekrar erişilebilir
            olduğunda bu sayfa otomatik yenilenir.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Başvurular" value={stats.total} />
              <StatCard label="Aktif" value={stats.active} />
              <StatCard label="Tamamlanan" value={stats.completed} />
            </div>

            <section className="rounded-lg border border-border/40 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
                <h2 className="text-sm font-medium">Son Başvurular</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {recent.length} / {applications.length}
                </span>
              </div>
              {recent.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Henüz gösterilecek bir başvuru yok.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        Başvuru
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        Aşama
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        Başvuru Formu
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        Güncellendi
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
                            className="text-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline"
                          >
                            Evrak Yükleme
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StageBadge stage={application.currentStage} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/applications/${application.id}?view=form`}
                            className="text-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline"
                          >
                            Başvuru Formu
                          </Link>
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
  if (session.role === Role.ADMIN) {
    let stats: AdminStats | null = null;
    let initialApplications: AdminApplicationRow[] = [];
    let adminError = false;
    try {
      [stats, initialApplications] = await Promise.all([
        serverApi.get<AdminStats>("/admin/stats"),
        serverApi.get<AdminApplicationRow[]>("/applications/all"),
      ]);
    } catch {
      adminError = true;
    }

    if (adminError || !stats) {
      return (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Genel Bakış</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Tüm birimlerdeki ve aşamalardaki başvuruların özeti.
            </p>
          </div>
          <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
            Analitik veriler şu anda yüklenemiyor. Hizmet tekrar erişilebilir
            olduğunda sayfa otomatik yenilenecektir.
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Genel Bakış</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Tüm birimlerdeki ve aşamalardaki başvuruların özeti.
          </p>
        </div>

        <AdminOverviewPanel
          stats={stats}
          initialApplications={initialApplications}
        />
      </div>
    );
  }

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

  const queueCount = queue.length;
  const recent = assigned.slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Genel Bakış</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Birim kuyruğunuz ve aktif olarak işlediğiniz başvurular.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Çalışma alanı şu anda yüklenemiyor. Hizmet tekrar erişilebilir
          olduğunda sayfa otomatik yenilenir.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Kuyruğunuzda"
              value={queueCount}
              hint="Alınmayı bekliyor"
              href="/dashboard/pool"
            />
            <StatCard
              label="Size atanan"
              value={assigned.length}
              hint="Aktif işlemde"
              href="/dashboard/workspace"
            />
          </div>

          <section className="rounded-lg border border-border/40 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
              <h2 className="text-sm font-medium">Size Atananlar</h2>
              <Link
                href="/dashboard/workspace"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Tümünü Gör
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                Henüz bir atama yok. İş almak için{" "}
                <Link
                  href="/dashboard/pool"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  iş havuzunu
                </Link>
                kullanın.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Başvuran
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Aşama
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Aşamada Geçen Süre
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
