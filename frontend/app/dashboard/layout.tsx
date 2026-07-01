import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { RealtimeBridge } from "@/components/dashboard/realtime-bridge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import { getSession } from "@/lib/api.server";
import { Role } from "@/lib/enums";

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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">Alsasvize</span>
          </Link>

          <div className="flex items-center gap-3">
            <RealtimeBridge enabled={isStaff} />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-xs text-muted-foreground">{session.email}</span>
              <Badge
                variant="outline"
                className="rounded-md font-mono text-[11px]"
              >
                {session.role}
              </Badge>
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
