"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, Users } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGE_LABEL } from "@/lib/status";
import type { StaffActivityEvent, StaffPerformance } from "@/lib/types";
import { cn } from "@/lib/utils";

const productivityConfig = {
  claimed: { label: "Alınan", color: "var(--muted-foreground)" },
  processed: { label: "İşlenen", color: "var(--foreground)" },
} satisfies ChartConfig;

const STAFF_PLACEHOLDER_VALUE = "__NONE__";

type ProductivityPoint = {
  staffId: string;
  name: string;
  claimed: number;
  processed: number;
};

type StaffOption = {
  staffId: string;
  fullName: string;
  department: StaffPerformance["department"];
};

type ActivityPoint = StaffActivityEvent & {
  happenedAtDate: Date;
  happenedAtMs: number;
  dayKey: string;
};

function toDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDayKey(dayKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return null;
  }

  const [yearPart, monthPart, dayPart] = dayKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    23,
    59,
    59,
    999,
  );
}

function createDefaultRange(): { from: Date; to: Date } {
  const today = startOfDay(new Date());
  return {
    from: new Date(today.getFullYear(), today.getMonth(), 1),
    to: today,
  };
}

function resolveRange(range: DateRange | undefined): { from: Date; to: Date } | null {
  const from = range?.from ? startOfDay(range.from) : null;
  if (!from) {
    return null;
  }

  const to = range?.to ? startOfDay(range.to) : from;
  if (from.getTime() <= to.getTime()) {
    return { from, to };
  }

  return { from: to, to: from };
}

function formatRangeDate(value: Date): string {
  return value.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

function formatRangeLabel(range: DateRange | undefined): string {
  const resolved = resolveRange(range);
  if (!resolved) {
    return "Tarih seçin";
  }

  if (resolved.from.getTime() === resolved.to.getTime()) {
    return formatRangeDate(resolved.from);
  }

  return `${formatRangeDate(resolved.from)} - ${formatRangeDate(resolved.to)}`;
}

function formatAppliedRangeLabel(range: { from: Date; to: Date }): string {
  if (range.from.getTime() === range.to.getTime()) {
    return formatRangeDate(range.from);
  }

  return `${formatRangeDate(range.from)} - ${formatRangeDate(range.to)}`;
}

function stageLabel(stage: StaffActivityEvent["stageFrom"]): string {
  if (!stage) {
    return "Belirsiz";
  }
  return STAGE_LABEL[stage] ?? stage;
}

function describeActivity(event: StaffActivityEvent): string {
  const from = stageLabel(event.stageFrom);
  const to = stageLabel(event.stageTo);
  return `${from} -> ${to}`;
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readStaffId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const direct = (payload as { staffId?: unknown }).staffId;
  if (typeof direct === "string") {
    return direct;
  }

  const nested = (payload as { payload?: { staffId?: unknown } }).payload?.staffId;
  return typeof nested === "string" ? nested : null;
}

function StaffAxisTick({
  x = 0,
  y = 0,
  payload,
  namesById,
  selectedStaffId,
  onStaffSelect,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: unknown };
  namesById: Map<string, string>;
  selectedStaffId?: string | null;
  onStaffSelect?: (staffId: string | null) => void;
}) {
  const positionX = typeof x === "number" ? x : Number(x) || 0;
  const positionY = typeof y === "number" ? y : Number(y) || 0;
  const staffId = typeof payload?.value === "string" ? (payload.value as string) : "";
  const label = namesById.get(staffId) ?? staffId;
  const isSelected = selectedStaffId === staffId;

  return (
    <g transform={`translate(${positionX},${positionY})`}>
      <text
        x={0}
        y={0}
        dy={14}
        transform="rotate(-32)"
        textAnchor="end"
        fontSize={10}
        fill={isSelected ? "var(--foreground)" : "var(--muted-foreground)"}
        style={{ cursor: "pointer" }}
        onClick={() => {
          if (staffId) {
            onStaffSelect?.(isSelected ? null : staffId);
          }
        }}
      >
        {label}
      </text>
    </g>
  );
}

function ProductivityChart({
  title,
  description,
  rows,
  selectedStaffId,
  onStaffSelect,
}: {
  title: string;
  description: string;
  rows: StaffPerformance[];
  selectedStaffId?: string | null;
  onStaffSelect?: (staffId: string | null) => void;
}) {
  const data: ProductivityPoint[] = rows.map((row) => ({
    staffId: row.staffId,
    name: row.fullName,
    claimed: row.claimed,
    processed: row.processed,
  }));
  const namesById = new Map(data.map((row) => [row.staffId, row.name]));

  return (
    <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Henüz personel aktivitesi kaydedilmedi.</p>
      ) : (
        <ChartContainer config={productivityConfig} className="mt-4 h-60 w-full">
          <BarChart data={data} margin={{ left: -16, top: 8, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="staffId"
              tickLine={false}
              axisLine={false}
              interval={0}
              height={70}
              tick={(props) => (
                <StaffAxisTick
                  x={props.x}
                  y={props.y}
                  payload={props.payload}
                  namesById={namesById}
                  selectedStaffId={selectedStaffId}
                  onStaffSelect={onStaffSelect}
                />
              )}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={28}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="claimed"
              fill="var(--color-claimed)"
              radius={4}
              onClick={(payload) => {
                const staffId = readStaffId(payload);
                if (staffId) {
                  onStaffSelect?.(selectedStaffId === staffId ? null : staffId);
                }
              }}
            >
              {data.map((row) => {
                const dimmed = selectedStaffId && selectedStaffId !== row.staffId;
                return (
                  <Cell
                    key={`claimed-${row.staffId}`}
                    fill="var(--color-claimed)"
                    fillOpacity={dimmed ? 0.35 : 1}
                  />
                );
              })}
            </Bar>
            <Bar
              dataKey="processed"
              fill="var(--color-processed)"
              radius={4}
              onClick={(payload) => {
                const staffId = readStaffId(payload);
                if (staffId) {
                  onStaffSelect?.(selectedStaffId === staffId ? null : staffId);
                }
              }}
            >
              {data.map((row) => {
                const dimmed = selectedStaffId && selectedStaffId !== row.staffId;
                return (
                  <Cell
                    key={`processed-${row.staffId}`}
                    fill="var(--color-processed)"
                    fillOpacity={dimmed ? 0.35 : 1}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </section>
  );
}

function ActivityCalendarPanel({
  staffOptions,
  draftStaffId,
  onDraftStaffChange,
  draftRange,
  onDraftRangeChange,
  calendarMonth,
  onCalendarMonthChange,
  isDatePopoverOpen,
  onDatePopoverOpenChange,
  onClearDraftRange,
  onUseTodayRange,
  onApplyFilters,
  canApplyFilters,
  appliedStaffName,
  appliedRangeLabel,
  filteredCount,
  daysWithActivity,
}: {
  staffOptions: StaffOption[];
  draftStaffId: string;
  onDraftStaffChange: (value: string) => void;
  draftRange: DateRange | undefined;
  onDraftRangeChange: (value: DateRange | undefined) => void;
  calendarMonth: Date;
  onCalendarMonthChange: (value: Date) => void;
  isDatePopoverOpen: boolean;
  onDatePopoverOpenChange: (value: boolean) => void;
  onClearDraftRange: () => void;
  onUseTodayRange: () => void;
  onApplyFilters: () => void;
  canApplyFilters: boolean;
  appliedStaffName: string | null;
  appliedRangeLabel: string;
  filteredCount: number;
  daysWithActivity: Date[];
}) {
  return (
    <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium">Personel İşlem Takvimi</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Çalışan ve tarih aralığı seçerek işlem zaman akışını filtreleyin.
      </p>

      <div className="mt-4 rounded-lg border border-border/40 bg-background shadow-sm">
        <div className="flex flex-col md:flex-row">
          <div className="border-b border-border/40 md:flex-1 md:border-r md:border-b-0">
            <Select value={draftStaffId} onValueChange={onDraftStaffChange}>
              <SelectTrigger className="h-14 w-full rounded-none border-0 px-4 shadow-none focus-visible:ring-0">
                <div className="flex min-w-0 items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div className="flex min-w-0 flex-col items-start text-left">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Çalışan</span>
                    <SelectValue
                      placeholder="Çalışan seçin"
                      className="max-w-full truncate text-sm font-medium text-foreground"
                    />
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STAFF_PLACEHOLDER_VALUE}>Çalışan seçin</SelectItem>
                {staffOptions.map((staff) => (
                  <SelectItem key={staff.staffId} value={staff.staffId}>
                    {staff.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-b border-border/40 md:flex-1 md:border-r md:border-b-0">
            <Popover open={isDatePopoverOpen} onOpenChange={onDatePopoverOpenChange}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-14 w-full items-center justify-between px-4 text-left transition-colors hover:bg-muted/20"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Tarih</span>
                      <span
                        className={cn(
                          "max-w-full truncate text-sm font-medium",
                          resolveRange(draftRange) ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {formatRangeLabel(draftRange)}
                      </span>
                    </div>
                  </div>
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-auto p-2" align="start">
                <Calendar
                  mode="range"
                  selected={draftRange}
                  onSelect={onDraftRangeChange}
                  month={calendarMonth}
                  onMonthChange={onCalendarMonthChange}
                  fromYear={1900}
                  toYear={2100}
                  modifiers={{
                    hasActivity: daysWithActivity,
                  }}
                  modifiersClassNames={{
                    hasActivity: "font-semibold text-slate-900",
                  }}
                />

                <div className="mt-2 flex items-center justify-between border-t border-slate-200 px-1 pt-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-[#0b63f6] underline-offset-4 transition-colors hover:text-[#0a57d9] hover:underline"
                    onClick={onClearDraftRange}
                  >
                    Temizle
                  </button>

                  <button
                    type="button"
                    className="text-xs font-medium text-[#0b63f6] underline-offset-4 transition-colors hover:text-[#0a57d9] hover:underline"
                    onClick={onUseTodayRange}
                  >
                    Bugün
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="p-1.5 md:w-[140px]">
            <Button type="button" className="h-11 w-full" onClick={onApplyFilters} disabled={!canApplyFilters}>
              <Search className="h-4 w-4" aria-hidden />
              Getir
            </Button>
          </div>
        </div>
      </div>

      {appliedStaffName ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Seçili personel: <span className="font-medium text-foreground">{appliedStaffName}</span> · Aralık: {appliedRangeLabel} · {filteredCount} işlem
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Önce çalışan ve tarih aralığı seçip Getir düğmesine tıklayın.
        </p>
      )}
    </section>
  );
}

function ActivityTimelinePanel({
  selectedStaffName,
  selectedStaffId,
  appliedRangeLabel,
  timelineEvents,
}: {
  selectedStaffName: string | null;
  selectedStaffId?: string | null;
  appliedRangeLabel: string;
  timelineEvents: ActivityPoint[];
}) {
  return (
    <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium">Personel Zaman Akışı</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Getir ile uygulanan tarih aralığındaki işlem kayıtları.
      </p>

      {!selectedStaffId ? (
        <p className="mt-4 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Çalışan seçildiğinde burada işlem saatleri ve dosyalar listelenir.
        </p>
      ) : timelineEvents.length === 0 ? (
        <p className="mt-4 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Bu tarih aralığında {selectedStaffName ?? "seçili personel"} için işlem kaydı yok.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs text-muted-foreground">
            Personel: <span className="font-medium text-foreground">{selectedStaffName}</span> · Aralık: {appliedRangeLabel} · {timelineEvents.length} işlem
          </p>

          <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {timelineEvents.map((event) => (
              <article
                key={`${event.applicationId}-${event.happenedAtMs}-${event.actionType}`}
                className="rounded-md border border-border/50 bg-muted/20 p-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{event.customerName}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {event.actionType} · {describeActivity(event)}
                    </p>
                  </div>
                  <p className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {event.happenedAtDate.toLocaleDateString("tr-TR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                    <br />
                    {formatTime(event.happenedAtDate)}
                  </p>
                </div>
                <Link
                  href={`/dashboard/applications/${event.applicationId}`}
                  className="mt-1 inline-block text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Dosyayı aç
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function AdminStatsCharts({
  salesProductivity,
  docProductivity,
  staffActivityEvents,
  selectedStaffId,
  onStaffSelect,
}: {
  salesProductivity: StaffPerformance[];
  docProductivity: StaffPerformance[];
  staffActivityEvents: StaffActivityEvent[];
  selectedStaffId?: string | null;
  onStaffSelect?: (staffId: string | null) => void;
}) {
  const [draftStaffId, setDraftStaffId] = useState<string>(
    selectedStaffId ?? STAFF_PLACEHOLDER_VALUE,
  );
  const [isDatePopoverOpen, setDatePopoverOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() => {
    const initialRange = createDefaultRange();
    return {
      from: initialRange.from,
      to: initialRange.to,
    };
  });
  const [appliedRange, setAppliedRange] = useState<{ from: Date; to: Date }>(
    () => createDefaultRange(),
  );
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => createDefaultRange().from);
  const [appliedStaffId, setAppliedStaffId] = useState<string | null>(
    selectedStaffId ?? null,
  );

  const staffOptions = useMemo(() => {
    const deduped = new Map<string, StaffOption>();

    for (const staff of [...salesProductivity, ...docProductivity]) {
      if (!deduped.has(staff.staffId)) {
        deduped.set(staff.staffId, {
          staffId: staff.staffId,
          fullName: staff.fullName,
          department: staff.department,
        });
      }
    }

    return Array.from(deduped.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "tr", { sensitivity: "base" }),
    );
  }, [docProductivity, salesProductivity]);

  const staffNameMap = useMemo(
    () => new Map(staffOptions.map((staff) => [staff.staffId, staff.fullName])),
    [staffOptions],
  );

  const normalizedEvents = useMemo(
    () =>
      staffActivityEvents
        .map((event) => {
          const happenedAtDate = new Date(event.happenedAt);
          if (Number.isNaN(happenedAtDate.getTime())) {
            return null;
          }

          return {
            ...event,
            happenedAtDate,
            happenedAtMs: happenedAtDate.getTime(),
            dayKey: toDayKey(happenedAtDate),
          };
        })
        .filter((event): event is ActivityPoint => Boolean(event)),
    [staffActivityEvents],
  );

  const resolvedDraftRange = useMemo(() => resolveRange(draftRange), [draftRange]);

  const canApplyFilters = Boolean(
    resolvedDraftRange && draftStaffId !== STAFF_PLACEHOLDER_VALUE,
  );

  const appliedRangeLabel = useMemo(
    () => formatAppliedRangeLabel(appliedRange),
    [appliedRange],
  );

  const appliedRangeStartMs = useMemo(
    () => appliedRange.from.getTime(),
    [appliedRange],
  );

  const appliedRangeEndMs = useMemo(
    () => endOfDay(appliedRange.to).getTime(),
    [appliedRange],
  );

  const filteredEvents = useMemo(() => {
    if (!appliedStaffId) {
      return [];
    }

    return normalizedEvents
      .filter((event) => event.staffId === appliedStaffId)
      .filter(
        (event) =>
          event.happenedAtMs >= appliedRangeStartMs && event.happenedAtMs <= appliedRangeEndMs,
      )
      .sort((a, b) => b.happenedAtMs - a.happenedAtMs);
  }, [appliedRangeEndMs, appliedRangeStartMs, appliedStaffId, normalizedEvents]);

  const draftStaffActivityDays = useMemo(() => {
    const selectedId = draftStaffId === STAFF_PLACEHOLDER_VALUE ? null : draftStaffId;
    if (!selectedId) {
      return [];
    }

    return Array.from(
      new Set(
        normalizedEvents
          .filter((event) => event.staffId === selectedId)
          .map((event) => event.dayKey),
      ),
    )
      .map(parseDayKey)
      .filter((value): value is Date => Boolean(value));
  }, [draftStaffId, normalizedEvents]);

  const highlightedStaffId = draftStaffId === STAFF_PLACEHOLDER_VALUE ? null : draftStaffId;

  const appliedStaffName = appliedStaffId
    ? staffNameMap.get(appliedStaffId) ?? "Bilinmeyen personel"
    : null;

  useEffect(() => {
    setDraftStaffId(selectedStaffId ?? STAFF_PLACEHOLDER_VALUE);
    setAppliedStaffId(selectedStaffId ?? null);
  }, [selectedStaffId]);

  function handleApplyFilters() {
    if (!resolvedDraftRange) {
      return;
    }

    const nextStaffId =
      draftStaffId === STAFF_PLACEHOLDER_VALUE ? null : draftStaffId;

    setAppliedStaffId(nextStaffId);
    setAppliedRange(resolvedDraftRange);
    onStaffSelect?.(nextStaffId);
    setDatePopoverOpen(false);
  }

  function handleChartStaffSelect(nextStaffId: string | null) {
    setDraftStaffId(nextStaffId ?? STAFF_PLACEHOLDER_VALUE);
    setAppliedStaffId(nextStaffId);
    onStaffSelect?.(nextStaffId);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ActivityCalendarPanel
        staffOptions={staffOptions}
        draftStaffId={draftStaffId}
        onDraftStaffChange={setDraftStaffId}
        draftRange={draftRange}
        onDraftRangeChange={setDraftRange}
        calendarMonth={calendarMonth}
        onCalendarMonthChange={setCalendarMonth}
        isDatePopoverOpen={isDatePopoverOpen}
        onDatePopoverOpenChange={setDatePopoverOpen}
        onClearDraftRange={() => setDraftRange(undefined)}
        onUseTodayRange={() => {
          const today = startOfDay(new Date());
          setDraftRange({ from: today, to: today });
          setCalendarMonth(today);
        }}
        onApplyFilters={handleApplyFilters}
        canApplyFilters={canApplyFilters}
        appliedStaffName={appliedStaffName}
        appliedRangeLabel={appliedRangeLabel}
        filteredCount={filteredEvents.length}
        daysWithActivity={draftStaffActivityDays}
      />
      <ProductivityChart
        title="Satış Verimliliği"
        description="Satış personeli bazında alınan ve işlenen başvurular."
        rows={salesProductivity}
        selectedStaffId={highlightedStaffId}
        onStaffSelect={handleChartStaffSelect}
      />
      <ActivityTimelinePanel
        selectedStaffName={appliedStaffName}
        selectedStaffId={appliedStaffId}
        appliedRangeLabel={appliedRangeLabel}
        timelineEvents={filteredEvents}
      />
      <ProductivityChart
        title="Evrak Verimliliği"
        description="Evrak personeli bazında alınan ve işlenen başvurular."
        rows={docProductivity}
        selectedStaffId={highlightedStaffId}
        onStaffSelect={handleChartStaffSelect}
      />
    </div>
  );
}
