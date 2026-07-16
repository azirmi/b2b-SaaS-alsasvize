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
import { APPLICATION_TYPE_LABEL } from "@/lib/application-type";
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
  const isSales = session.role === Role.SALES;
  const wantsHistory = isAdmin || isSales;
  const workspaceTitle = isAdmin ? "Atanan Dosyalarım" : "Atanan Başvurularım";

  // Assigned workspace + (for sales/admin) processed-sales history in parallel,
  // with isolated failure so one endpoint hiccuping never blanks the other.
  const [assignedResult, historyResult] = await Promise.allSettled([
    serverApi.get<AssignedApplication[]>("/applications/assigned"),
    wantsHistory
      ? serverApi.get<AssignedApplication[]>("/applications/sales-history")
      : Promise.resolve<AssignedApplication[]>([]),
  ]);

  const applications =
    assignedResult.status === "fulfilled" ? assignedResult.value : [];
  const loadError = assignedResult.status === "rejected";
  const historyLoadError = wantsHistory && historyResult.status === "rejected";
  const salesHistory =
    historyResult.status === "fulfilled" ? historyResult.value : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{workspaceTitle}</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isAdmin
              ? "Tüm birimlerde size atanan ve işlemde olan dosyalar."
              : "Üzerinize atanan ve aktif olarak işlediğiniz başvurular."}
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {applications.length} aktif
        </span>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-border/40 bg-card p-4 text-sm text-muted-foreground shadow-sm sm:p-6">
          Çalışma alanınız şu anda yüklenemiyor. Hizmet tekrar erişilebilir
          olduğunda sayfa otomatik yenilenir.
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card px-3 py-14 text-center text-sm text-muted-foreground shadow-sm sm:px-5 sm:py-16">
          Henüz size atanmış başvuru yok. İş almak için{" "}
          <Link
            href="/dashboard/pool"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            başvuru havuzuna
          </Link>
          gidin.
        </div>
      ) : (
        <section className="rounded-lg border border-border/40 bg-card shadow-sm">
          <div className="space-y-3 px-3 py-4 md:hidden">
            {applications.map((application) => (
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

                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Evrak
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" aria-hidden />
                      <span className="tabular-nums">{application._count.documents}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex justify-end border-t border-border/30 pt-3">
                  <Link
                    href={`/dashboard/applications/${application.id}`}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Dosyayı Aç
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
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
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    Evrak
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">
                    Aşamadaki Süre
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">
                    <span className="sr-only">Dosyayı Aç</span>
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
                      <div className="text-xs text-muted-foreground">
                        {APPLICATION_TYPE_LABEL[application.applicationType]}
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
                        Dosyayı Aç
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {wantsHistory ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                İşlenen Satış Başvuruları
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {isAdmin
                  ? "Satış temsilcileri tarafından işlenen tüm başvuruların salt okunur görünümü."
                  : "İşlediğiniz satış başvurularının salt okunur görünümü."}
              </p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {salesHistory.length} kayıt
            </span>
          </div>

          {historyLoadError ? (
            <div className="rounded-lg border border-border/40 bg-card p-4 text-sm text-muted-foreground shadow-sm sm:p-6">
              Satış geçmişi şu anda yüklenemiyor. Lütfen daha sonra tekrar deneyin.
            </div>
          ) : (
            <div className="rounded-lg border border-border/40 bg-card shadow-sm">
              {salesHistory.length === 0 ? (
                <div className="px-3 py-14 text-center text-sm text-muted-foreground sm:px-5 sm:py-16">
                  Henüz işlenmiş satış kaydı yok.
                </div>
              ) : (
                <>
                  <div className="space-y-3 px-3 py-4 md:hidden">
                    {salesHistory.map((application) => (
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
                              Son Güncelleme
                            </p>
                            <p className="font-mono text-xs tabular-nums text-muted-foreground">
                              {timeAgo(application.stageUpdatedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end border-t border-border/30 pt-3">
                          <Link
                            href={`/dashboard/applications/${application.id}`}
                            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                          >
                            Detayları Görüntüle
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
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
                            Son Güncelleme
                          </TableHead>
                          <TableHead className="text-right text-xs font-medium text-muted-foreground">
                            <span className="sr-only">Dosyayı Aç</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesHistory.map((application) => (
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
                            <TableCell className="text-right">
                              <Link
                                href={`/dashboard/applications/${application.id}`}
                                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                              >
                                Detayları Görüntüle
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
