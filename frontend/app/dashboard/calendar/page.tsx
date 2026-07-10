import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession, serverApi } from "@/lib/api.server";
import { Role } from "@/lib/enums";
import type { AppointmentCalendarRow } from "@/lib/types";

function formatDateTime(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return "—";
  }
  return value.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== Role.ADMIN && session.role !== Role.DOC) {
    redirect("/dashboard");
  }

  let appointments: AppointmentCalendarRow[] = [];
  let loadError = false;

  try {
    appointments = await serverApi.get<AppointmentCalendarRow[]>(
      "/applications/appointments",
    );
  } catch {
    loadError = true;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Takvim</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Randevu tarihi tanımlı dosyaların kronolojik ajandası.
        </p>
      </div>

      <section className="rounded-lg border border-border/40 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
          <h2 className="text-sm font-medium">Global Randevu Ajandası</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {appointments.length} kayıt
          </span>
        </div>

        {loadError ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Takvim verileri şu anda yüklenemiyor.
          </div>
        ) : appointments.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Henüz tanımlı bir randevu yok.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Tarih & Saat
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Müşteri
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Randevu Şehri
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Evrak Sorumlusu
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Başvuru
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow
                  key={`${appointment.applicationId}-${appointment.appointmentDate}`}
                  className="border-border/40"
                >
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(appointment.appointmentDate)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {appointment.customerName}
                  </TableCell>
                  <TableCell className="text-sm">{appointment.appointmentCity}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {appointment.docStaffName ?? "Atama bekliyor"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/applications/${appointment.applicationId}`}
                      className="font-mono text-xs underline-offset-4 hover:underline"
                    >
                      {appointment.applicationId}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
