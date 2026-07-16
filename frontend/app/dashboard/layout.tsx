import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";

import { AdminMessageComposer } from "@/components/dashboard/admin-message-composer";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { RealtimeBridge } from "@/components/dashboard/realtime-bridge";
import { StaffMessagesBell } from "@/components/dashboard/staff-messages-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import { getSession } from "@/lib/api.server";
import { Role } from "@/lib/enums";

const ROLE_BADGE_LABEL: Partial<Record<Role, string>> = {
  [Role.ADMIN]: "Yönetici",
  [Role.SALES]: "Satış",
  [Role.DOC]: "Evrak",
  [Role.SEC]: "Sekreterya",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const isStaff = session.role !== Role.CUSTOMER;
  const roleBadgeLabel = ROLE_BADGE_LABEL[session.role] ?? session.role;

  return (
    <div className="flex min-h-full w-full max-w-full flex-1 flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 w-full overflow-x-hidden border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between gap-4 px-3 py-2 sm:px-6 lg:max-w-[1400px]">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Image
                src="/logo.jpg"
                alt="Alsasvize"
                width={190}
                height={64}
                priority
                className="h-16 w-auto object-contain"
              />
            </Link>
            {isStaff ? <DashboardNav role={session.role} /> : null}
          </div>

          <div className="flex items-center gap-3">
            <RealtimeBridge enabled={isStaff} />
            <AdminMessageComposer role={session.role} />
            <StaffMessagesBell role={session.role} />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-xs text-muted-foreground">{session.email}</span>
              {session.role !== Role.CUSTOMER ? (
                <Badge
                  variant="outline"
                  className="rounded-md font-mono text-[11px]"
                >
                  {roleBadgeLabel}
                </Badge>
              ) : null}
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Çıkış yap
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-full flex-1 overflow-x-hidden px-3 py-5 sm:px-6 lg:max-w-[1200px] lg:py-6">
        {children}
      </main>
    </div>
  );
}
