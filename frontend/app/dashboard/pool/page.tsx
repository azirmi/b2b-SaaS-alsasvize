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
              ? "Tüm birimlerde havuzda bekleyen başvurular."
              : "Birim kuyruğunuzdaki alınmamış başvurular. En uzun bekleyenler üstte listelenir."}
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {applications.length} bekleyen
        </span>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Havuz başvuruları şu anda yüklenemiyor. Hizmet tekrar erişilebilir
          olduğunda sayfa otomatik yenilenir.
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card px-5 py-16 text-center text-sm text-muted-foreground shadow-sm">
          Kuyruğunuzda hiçbir başvuru yok. Yeni işler buraya geldiği anda
          görünecek.
        </div>
      ) : (
        <section className="rounded-lg border border-border/40 bg-card shadow-sm">
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
        </section>
      )}
    </div>
  );
}
