import Link from "next/link";
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
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-border/60 bg-muted/90 p-1 pr-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:w-fit md:overflow-visible md:pr-1">
          <TabsTrigger value="overview" className="flex-none">
            Genel Bakış
          </TabsTrigger>
          <TabsTrigger value="finance" className="flex-none">
            Finans & Muhasebe
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex-none">
            Performans & Uyum
          </TabsTrigger>
          <TabsTrigger value="master" className="flex-none">
            Master Tablo
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex-none">
            Takvim
          </TabsTrigger>
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

        <TabsContent value="calendar">
          <section className="rounded-lg border border-border/40 bg-card p-4 text-sm shadow-sm sm:p-5">
            <h2 className="text-sm font-medium">Takvim</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Günlük operasyon takvimine geçerek randevu ve işlem akışını detaylı takip edin.
            </p>
            <Link
              href="/dashboard/calendar"
              className="mt-4 inline-flex items-center rounded-md border border-border/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Takvimi Aç
            </Link>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
