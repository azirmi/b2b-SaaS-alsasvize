import { redirect } from "next/navigation";

import { StaffActivityExplorer } from "@/components/admin/staff-activity-explorer";
import { getSession, serverApi } from "@/lib/api.server";
import { Role } from "@/lib/enums";
import type { AdminStats } from "@/lib/types";

export default async function StaffActivityPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  let stats: AdminStats | null = null;
  let loadError = false;

  try {
    stats = await serverApi.get<AdminStats>("/admin/stats");
  } catch {
    loadError = true;
  }

  if (loadError || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Personel Aktivite Takibi</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Personel işlemlerini tarih aralığına göre filtreleyin ve zaman akışını izleyin.
          </p>
        </div>

        <div className="rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Personel aktivite verileri şu anda yüklenemiyor. Lütfen daha sonra tekrar deneyin.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Personel Aktivite Takibi</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Çalışan seçip tarih aralığı belirleyin, ardından işlem zaman akışını detaylı inceleyin.
        </p>
      </div>

      <StaffActivityExplorer
        salesProductivity={stats.salesProductivity}
        docProductivity={stats.docProductivity}
        staffActivityEvents={stats.staffActivityEvents}
      />
    </div>
  );
}
