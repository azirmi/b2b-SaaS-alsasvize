import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { APPLICATION_TYPE_LABEL } from "@/lib/application-type";
import { getSession, serverApi } from "@/lib/api.server";
import { Role } from "@/lib/enums";
import type { AppointmentCalendarRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthParam(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseMonth(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);
    const candidate = new Date(year, month - 1, 1);
    if (!Number.isNaN(candidate.getTime())) {
      return candidate;
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function addMonths(base: Date, offset: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

function startOfWeekMonday(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const delta = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - delta);
  return result;
}

function buildMonthCells(monthStart: Date): Array<{ key: string; date: Date; inMonth: boolean }> {
  const month = monthStart.getMonth();
  const firstGridDate = startOfWeekMonday(monthStart);

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(firstGridDate);
    cellDate.setDate(firstGridDate.getDate() + index);
    return {
      key: dateKey(cellDate),
      date: cellDate,
      inMonth: cellDate.getMonth() === month,
    };
  });
}

interface CalendarEvent extends AppointmentCalendarRow {
  timeLabel: string;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== Role.ADMIN && session.role !== Role.DOC) {
    redirect("/dashboard");
  }

  const query = (await searchParams) ?? {};
  const currentMonth = parseMonth(query.month);
  const prevMonth = addMonths(currentMonth, -1);
  const nextMonth = addMonths(currentMonth, 1);
  const todayKey = dateKey(new Date());

  let appointments: AppointmentCalendarRow[] = [];
  let loadError = false;

  try {
    appointments = await serverApi.get<AppointmentCalendarRow[]>(
      "/applications/appointments",
    );
  } catch {
    loadError = true;
  }

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const row of appointments) {
    const when = new Date(row.appointmentDate);
    if (Number.isNaN(when.getTime())) {
      continue;
    }
    const key = dateKey(when);
    const list = eventsByDay.get(key) ?? [];
    list.push({
      ...row,
      timeLabel: format(when, "HH:mm", { locale: tr }),
    });
    list.sort(
      (a, b) =>
        new Date(a.appointmentDate).getTime() -
        new Date(b.appointmentDate).getTime(),
    );
    eventsByDay.set(key, list);
  }

  const monthCells = buildMonthCells(currentMonth);
  const monthTitle = format(currentMonth, "LLLL yyyy", { locale: tr });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Takvim</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Aylik randevu plani. Gun kartlarindan dosyaya hizli gecis yapabilirsiniz.
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {appointments.length} toplam randevu
        </span>
      </div>

      <section className="space-y-3 rounded-lg border border-border/40 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5">
            <Link
              href={`/dashboard/calendar?month=${monthParam(prevMonth)}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Önceki ay"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={`/dashboard/calendar?month=${monthParam(nextMonth)}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Sonraki ay"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <h2 className="text-lg font-semibold tracking-tight capitalize">{monthTitle}</h2>

          <Link
            href={`/dashboard/calendar?month=${monthParam(new Date())}`}
            className="inline-flex h-8 items-center rounded-md border border-border/60 px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Bu Ay
          </Link>
        </div>

        {loadError ? (
          <div className="rounded-md border border-border/40 bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
            Takvim verileri şu anda yüklenemiyor.
          </div>
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-border/40">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="border-b border-border/40 bg-muted/50 px-3 py-2 text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}

                {monthCells.map((cell) => {
                  const events = eventsByDay.get(cell.key) ?? [];
                  const isToday = cell.key === todayKey;

                  return (
                    <div
                      key={cell.key}
                      className={cn(
                        "min-h-[132px] border-b border-r border-border/30 bg-background p-2 align-top",
                        !cell.inMonth && "bg-muted/20",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={cn(
                            "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-medium",
                            isToday
                              ? "bg-foreground text-background"
                              : cell.inMonth
                                ? "text-foreground"
                                : "text-muted-foreground",
                          )}
                        >
                          {cell.date.getDate()}
                        </span>
                        {events.length > 0 ? (
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            {events.length}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        {events.slice(0, 3).map((event) => (
                          <Link
                            key={`${event.applicationId}-${event.appointmentDate}`}
                            href={`/dashboard/applications/${event.applicationId}`}
                            className="block rounded-md border border-border/40 bg-muted/40 px-2 py-1.5 text-[11px] leading-tight transition-colors hover:border-border hover:bg-muted"
                          >
                            <p className="font-medium text-foreground">
                              {event.timeLabel} · {event.customerName}
                            </p>
                            <p className="mt-0.5 truncate text-muted-foreground">
                              {APPLICATION_TYPE_LABEL[event.applicationType]} · {event.appointmentCity}
                            </p>
                          </Link>
                        ))}

                        {events.length > 3 ? (
                          <p className="px-1 text-[11px] text-muted-foreground">
                            +{events.length - 3} daha
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
