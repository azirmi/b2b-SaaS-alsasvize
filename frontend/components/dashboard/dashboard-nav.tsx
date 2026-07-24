"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Role, type Role as RoleType } from "@/lib/enums";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

function linksForRole(role: RoleType): NavLink[] {
  const workspaceLabel =
    role === Role.ADMIN ? "Atanan Dosyalarım" : "Atanan Başvurularım";

  const links: NavLink[] = [
    {
      href: role === Role.ADMIN ? "/dashboard/admin" : "/dashboard",
      label: "Genel Bakış",
    },
    { href: "/dashboard/pool", label: "Başvuru Havuzu" },
    { href: "/dashboard/workspace", label: workspaceLabel },
  ];

  if (role === Role.ADMIN || role === Role.DOC) {
    links.push({ href: "/dashboard/calendar", label: "Takvim" });
  }

  if (role === Role.ADMIN) {
    links.push({ href: "/dashboard/staff-activity", label: "Personel Aktivite" });
  }

  return links;
}

/** Primary staff navigation with an active-route indicator. */
export function DashboardNav({ role }: { role: RoleType }) {
  const pathname = usePathname();
  const links = linksForRole(role);

  const isActive = (href: string): boolean => {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md bg-transparent px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-[#23345D] font-medium text-white"
                : "text-gray-600 hover:bg-[#23345D]/10 hover:text-[#23345D]",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
