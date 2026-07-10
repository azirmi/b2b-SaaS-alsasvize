"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Role, type Role as RoleType } from "@/lib/enums";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

function linksForRole(role: RoleType): NavLink[] {
  const links: NavLink[] = [
    {
      href: role === Role.ADMIN ? "/dashboard/admin" : "/dashboard",
      label: "Genel Bakış",
    },
    { href: "/dashboard/pool", label: "İş Havuzu" },
    { href: "/dashboard/workspace", label: "Çalışma Alanım" },
  ];

  if (role === Role.ADMIN || role === Role.DOC) {
    links.push({ href: "/dashboard/calendar", label: "Takvim" });
  }

  return links;
}

/** Primary staff navigation with an active-route indicator. */
export function DashboardNav({ role }: { role: RoleType }) {
  const pathname = usePathname();
  const links = linksForRole(role);

  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {links.map((link) => {
        const active =
          link.href === "/dashboard/admin"
            ? pathname === "/dashboard/admin" || pathname === "/dashboard"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
