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
import { APPLICATION_TYPE_LABEL } from "@/lib/application-type";
import { getSession, serverApi } from "@/lib/api.server";
import { Role, VisaStage } from "@/lib/enums";
import { timeAgo } from "@/lib/format";
import type {
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

function formatSinceStart(iso: string): string {
  const ago = timeAgo(iso);
  if (ago === "az önce") {
    return "Süreç başlangıcı: az önce";
  }
  return `Süreç başlangıcı: ${ago} önce`;
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
          <h1 className="text-2xl font-semibold tracking-tight">Başvuru Panelim</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Tüm başvuru süreçlerinizi ve güncel durumlarını tek ekrandan takip edin.
          </p>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-border/40 bg-card p-4 text-sm text-muted-foreground shadow-sm sm:p-6">
            Başvurularınız şu anda yüklenemiyor. Hizmet tekrar erişilebilir
            olduğunda bu sayfa otomatik yenilenir.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Toplam Başvuru" value={stats.total} />
              <StatCard label="Devam Eden Süreç" value={stats.active} />
              <StatCard label="Tamamlanan Süreç" value={stats.completed} />
            </div>

            <section className="rounded-lg border border-border/40 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-3.5 sm:px-5">
                <h2 className="text-sm font-medium">Başvuru Süreçlerim</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {recent.length} / {applications.length}
                </span>
              </div>
              {recent.length === 0 ? (
                <div className="px-3 py-12 text-center text-sm text-muted-foreground sm:px-5">
                  Henüz gösterilecek bir başvuru süreci yok.
                </div>
              ) : (
                <>
                  <div className="space-y-3 px-3 py-4 md:hidden">
                    {recent.map((application) => (
                      <article
                        key={application.id}
                        className="rounded-lg border border-border/40 bg-background p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="min-w-0 space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Başvuru
                            </p>
                            <Link
                              href={`/dashboard/applications/${application.id}`}
                              className="text-sm font-medium text-primary underline underline-offset-4 decoration-primary/50 transition-colors hover:text-primary/80"
                            >
                              Evrak yükleme başlat
                            </Link>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {APPLICATION_TYPE_LABEL[application.applicationType]}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Süreç Durumu
                            </p>
                            <StageBadge
                              stage={application.currentStage}
                              customerView
                            />
                          </div>

                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Başvuru Formu
                            </p>
                            <Link
                              href={`/dashboard/applications/${application.id}?view=form`}
                              className="text-sm font-medium text-primary underline underline-offset-4 decoration-primary/50 transition-colors hover:text-primary/80"
                            >
                              Başvuru formu doldur
                            </Link>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Son Güncelleme
                            </p>
                            <p className="font-mono text-xs tabular-nums text-muted-foreground">
                              {formatSinceStart(application.createdAt)}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/40 hover:bg-transparent">
                          <TableHead className="text-xs font-medium text-muted-foreground">
                            Başvuru
                          </TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">
                            Süreç Durumu
                          </TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">
                            Başvuru Formu
                          </TableHead>
                          <TableHead className="text-right text-xs font-medium text-muted-foreground">
                            Son Güncelleme
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
                              <div className="mt-1 text-xs text-muted-foreground">
                                {APPLICATION_TYPE_LABEL[application.applicationType]}
                              </div>
                            </TableCell>
                            <TableCell>
                              <StageBadge
                                stage={application.currentStage}
                                customerView
                              />
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
                              {formatSinceStart(application.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  // ── Staff / admin overview ────────────────────────────────────────
  if (session.role === Role.ADMIN) {
    redirect("/dashboard/admin");
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
        <div className="rounded-lg border border-border/40 bg-card p-4 text-sm text-muted-foreground shadow-sm sm:p-6">
          Çalışma alanı şu anda yüklenemiyor. Hizmet tekrar erişilebilir
          olduğunda sayfa otomatik yenilenir.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Havuzda Bekleyen"
              value={queueCount}
              hint="Alınmayı bekliyor"
              href="/dashboard/pool"
            />
            <StatCard
              label="Size Atanan"
              value={assigned.length}
              hint="Aktif işlemde"
              href="/dashboard/workspace"
            />
          </div>

          <section className="rounded-lg border border-border/40 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-3.5 sm:px-5">
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
              <div className="px-3 py-12 text-center text-sm text-muted-foreground sm:px-5">
                Henüz bir atama yok. İş almak için{" "}
                <Link
                  href="/dashboard/pool"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  başvuru havuzunu
                </Link>
                kullanın.
              </div>
            ) : (
              <>
                <div className="space-y-3 px-3 py-4 md:hidden">
                  {recent.map((application) => (
                    <article
                      key={application.id}
                      className="rounded-lg border border-border/40 bg-background p-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Danışan
                        </p>
                        <Link
                          href={`/dashboard/applications/${application.id}`}
                          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {application.customer.fullName}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground break-all">
                          {application.customer.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {APPLICATION_TYPE_LABEL[application.applicationType]}
                        </p>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Süreç Durumu
                          </p>
                          <StageBadge stage={application.currentStage} />
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Aşamadaki Süre
                          </p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">
                            {timeAgo(application.stageUpdatedAt)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="text-xs font-medium text-muted-foreground">
                          Danışan
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">
                          Süreç Durumu
                        </TableHead>
                        <TableHead className="text-right text-xs font-medium text-muted-foreground">
                          Aşamadaki Süre
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
                            <div className="text-xs text-muted-foreground">
                              {APPLICATION_TYPE_LABEL[application.applicationType]}
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
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
