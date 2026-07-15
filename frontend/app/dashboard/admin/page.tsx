import { redirect } from "next/navigation";

import { AdminCompliancePanel } from "@/components/admin/admin-compliance-panel";
import { AdminFinancePanel } from "@/components/admin/admin-finance-panel";
import { AdminMasterTable } from "@/components/admin/admin-master-table";
import { AdminOverviewPanel } from "@/components/admin/admin-overview-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSession, serverApi } from "@/lib/api.server";
import { Role } from "@/lib/enums";
import type {
  AdminApplicationRow,
  AdminComplianceData,
  AdminFinanceData,
  AdminMasterTableRow,
  AdminStats,
} from "@/lib/types";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  let stats: AdminStats | null = null;
  let initialApplications: AdminApplicationRow[] = [];
  let compliance: AdminComplianceData | null = null;
  let finance: AdminFinanceData | null = null;
  let masterTableRows: AdminMasterTableRow[] = [];
  let loadError = false;

  try {
    [stats, initialApplications, compliance, finance, masterTableRows] = await Promise.all([
      serverApi.get<AdminStats>("/admin/stats"),
      serverApi.get<AdminApplicationRow[]>("/applications/all?sortBy=date&sortDirection=desc"),
      serverApi.get<AdminComplianceData>("/admin/compliance"),
      serverApi.get<AdminFinanceData>("/admin/finance"),
      serverApi.get<AdminMasterTableRow[]>("/admin/master-table"),
    ]);
  } catch {
    loadError = true;
  }

  if (loadError || !stats || !compliance || !finance) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Paneli</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Operasyon, performans ve uyum görünümü.
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Admin panel verileri şu anda yüklenemiyor. Hizmet tekrar erişilebilir
          olduğunda sayfa otomatik yenilenecektir.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Paneli</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Operasyon, performans ve uyum görünümü.
        </p>
      </div>

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList>
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="finance">Finans & Muhasebe</TabsTrigger>
          <TabsTrigger value="compliance">Performans & Uyum</TabsTrigger>
          <TabsTrigger value="master">Master Tablo</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverviewPanel
            stats={stats}
            initialApplications={initialApplications}
          />
        </TabsContent>

        <TabsContent value="finance">
          <AdminFinancePanel data={finance} />
        </TabsContent>

        <TabsContent value="compliance">
          <AdminCompliancePanel data={compliance} />
        </TabsContent>

        <TabsContent value="master">
          <AdminMasterTable rows={masterTableRows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
