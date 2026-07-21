import { redirect } from "next/navigation";

import { ClaimButton } from "@/components/pool/claim-button";
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
import type { VisaApplicationSummary } from "@/lib/types";

/** Unclaimed pool stages — the only stages a staff member can claim from. */
const POOL_STAGES = new Set<VisaStage>([
  VisaStage.SALES_POOL,
  VisaStage.DOC_POOL,
  VisaStage.SEC_POOL,
]);

export default async function PoolPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  // Customers have no work pool; send them to their own overview.
  if (session.role === Role.CUSTOMER) {
    redirect("/dashboard");
  }
  const isAdmin = session.role === Role.ADMIN;

  let applications: VisaApplicationSummary[] = [];
  let loadError = false;
  try {
    applications = await serverApi.get<VisaApplicationSummary[]>(
      "/applications/pool",
    );
  } catch {
    loadError = true;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Başvuru Havuzu</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isAdmin
              ? "Henüz personel tarafından alınmamış yeni başvurular."
              : "Birim kuyruğunuzdaki alınmamış başvurular. En uzun bekleyenler üstte listelenir."}
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {applications.length} bekleyen
        </span>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-border/40 bg-card p-4 text-sm text-muted-foreground shadow-sm sm:p-6">
          Havuz başvuruları şu anda yüklenemiyor. Hizmet tekrar erişilebilir
          olduğunda sayfa otomatik yenilenir.
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card px-3 py-14 text-center text-sm text-muted-foreground shadow-sm sm:px-5 sm:py-16">
          Kuyruğunuzda hiçbir başvuru yok. Yeni işler buraya geldiği anda
          görünecek.
        </div>
      ) : (
        <section className="rounded-lg border border-border/40 bg-card shadow-sm">
          <div className="space-y-3 px-3 py-4 md:hidden">
            {applications.map((application) => {
              const claimable = !isAdmin && POOL_STAGES.has(application.currentStage);
              return (
                <article
                  key={application.id}
                  className="rounded-lg border border-border/40 bg-background p-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Danışan
                    </p>
                    <p className="text-sm font-medium">{application.customer.fullName}</p>
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
                        Bekleme Süresi
                      </p>
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        {timeAgo(application.stageUpdatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end border-t border-border/30 pt-3">
                    {claimable ? (
                      <ClaimButton id={application.id} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </article>
              );
            })}
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
                    Bekleme Süresi
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">
                    İşlem
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => {
                  const claimable =
                    !isAdmin && POOL_STAGES.has(application.currentStage);
                  return (
                    <TableRow key={application.id} className="border-border/40">
                      <TableCell>
                        <div className="font-medium">
                          {application.customer.fullName}
                        </div>
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
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        {timeAgo(application.stageUpdatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {claimable ? (
                          <ClaimButton id={application.id} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
