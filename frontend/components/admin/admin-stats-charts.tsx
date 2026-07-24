"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Calendar } from "@/components/ui/calendar";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAGE_LABEL } from "@/lib/status";
import type {
  StaffActivityEvent,
  StaffPerformance,
} from "@/lib/types";

const productivityConfig = {
  claimed: { label: "Alınan", color: "var(--muted-foreground)" },
  processed: { label: "İşlenen", color: "var(--foreground)" },
} satisfies ChartConfig;

type ProductivityPoint = {
  staffId: string;
  name: string;
  claimed: number;
  processed: number;
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

function formatMonthValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthValue(value: string): { year: number; monthIndex: number } | null {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearPart, monthPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!year || !month || month < 1 || month > 12) {
    return null;
  }

  return {
    year,
    monthIndex: month - 1,
  };
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDay(day: number, maxDay: number): number {
  if (!Number.isFinite(day)) {
    return 1;
  }
  if (day < 1) {
    return 1;
  }
  if (day > maxDay) {
    return maxDay;
  }
  return Math.round(day);
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

function formatDayLabel(value: Date): string {
  return value.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
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

  const nested = (payload as { payload?: { staffId?: unknown } }).payload
    ?.staffId;
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
  onStaffSelect?: (staffId: string) => void;
}) {
  const positionX = typeof x === "number" ? x : Number(x) || 0;
  const positionY = typeof y === "number" ? y : Number(y) || 0;
  const staffId =
    typeof payload?.value === "string" ? (payload.value as string) : "";
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
            onStaffSelect?.(staffId);
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
  onStaffSelect?: (staffId: string) => void;
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
        <p className="mt-4 text-sm text-muted-foreground">
          Henüz personel aktivitesi kaydedilmedi.
        </p>
      ) : (
        <ChartContainer config={productivityConfig} className="mt-4 h-60 w-full">
          <BarChart data={data} margin={{ left: -16, top: 8, right: 8 }}>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
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
                  onStaffSelect?.(staffId);
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
                  onStaffSelect?.(staffId);
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
  selectedStaffName,
  selectedStaffId,
  monthValue,
  onMonthChange,
  startDay,
  endDay,
  maxDay,
  onStartDayChange,
  onEndDayChange,
  onResetRange,
  selectedDay,
  onSelectedDayChange,
  daysWithActivity,
  filteredCount,
}: {
  selectedStaffName: string | null;
  selectedStaffId?: string | null;
  monthValue: string;
  onMonthChange: (value: string) => void;
  startDay: number;
  endDay: number;
  maxDay: number;
  onStartDayChange: (value: number) => void;
  onEndDayChange: (value: number) => void;
  onResetRange: () => void;
  selectedDay: Date;
  onSelectedDayChange: (value: Date) => void;
  daysWithActivity: Date[];
  filteredCount: number;
}) {
  const parsedMonth = parseMonthValue(monthValue);
  const monthDate = parsedMonth
    ? new Date(parsedMonth.year, parsedMonth.monthIndex, 1)
    : new Date();
  const rangeFrom = Math.min(startDay, endDay);
  const rangeTo = Math.max(startDay, endDay);

  return (
    <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium">Personel İşlem Takvimi</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Verimlilik grafiğinden bir personel seçin, sonra ay içinde gün aralığı belirleyin.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Ay
          </span>
          <Input
            type="month"
            value={monthValue}
            onChange={(event) => onMonthChange(event.target.value)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Başlangıç Günü
          </span>
          <Input
            type="number"
            min={1}
            max={maxDay}
            value={startDay}
            onChange={(event) => {
              const raw = Number(event.target.value);
              onStartDayChange(clampDay(raw, maxDay));
            }}
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Bitiş Günü
          </span>
          <Input
            type="number"
            min={1}
            max={maxDay}
            value={endDay}
            onChange={(event) => {
              const raw = Number(event.target.value);
              onEndDayChange(clampDay(raw, maxDay));
            }}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Aralık: {rangeFrom}-{rangeTo}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onResetRange}>
          Ayın Tamamı
        </Button>
      </div>

      {!selectedStaffId ? (
        <p className="mt-4 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Takvimi görmek için Satış veya Evrak verimliliği grafiğinden bir personel seçin.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs text-muted-foreground">
            Seçili personel: <span className="font-medium text-foreground">{selectedStaffName}</span> ·
            Aralıkta {filteredCount} işlem
          </p>

          <div className="mt-3 w-full overflow-x-auto">
            <div className="min-w-[320px]">
              <Calendar
                mode="single"
                month={monthDate}
                onMonthChange={(nextMonth) => onMonthChange(formatMonthValue(nextMonth))}
                selected={selectedDay}
                onSelect={(value) => {
                  if (value) {
                    onSelectedDayChange(
                      new Date(value.getFullYear(), value.getMonth(), value.getDate()),
                    );
                  }
                }}
                disabled={(day) => {
                  if (
                    day.getFullYear() !== monthDate.getFullYear() ||
                    day.getMonth() !== monthDate.getMonth()
                  ) {
                    return true;
                  }

                  const dayOfMonth = day.getDate();
                  return dayOfMonth < rangeFrom || dayOfMonth > rangeTo;
                }}
                modifiers={{
                  hasActivity: daysWithActivity,
                }}
                modifiersClassNames={{
                  hasActivity: "bg-muted text-foreground font-semibold",
                }}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ActivityTimelinePanel({
  selectedStaffName,
  selectedStaffId,
  selectedDay,
  selectedDayEvents,
  timelineEvents,
}: {
  selectedStaffName: string | null;
  selectedStaffId?: string | null;
  selectedDay: Date;
  selectedDayEvents: ActivityPoint[];
  timelineEvents: ActivityPoint[];
}) {
  return (
    <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium">Personel Zaman Akışı</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Seçili gün ve aralık içindeki son işlemler.
      </p>

      {!selectedStaffId ? (
        <p className="mt-4 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Personel seçildiğinde burada işlem saatleri ve dosyalar listelenir.
        </p>
      ) : timelineEvents.length === 0 ? (
        <p className="mt-4 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Bu tarih aralığında {selectedStaffName ?? "seçili personel"} için işlem kaydı yok.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs text-muted-foreground">
            Gün: <span className="font-medium text-foreground">{formatDayLabel(selectedDay)}</span> ·
            Bu gün {selectedDayEvents.length} işlem
          </p>

          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {selectedDayEvents.length === 0 ? (
              <p className="rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Seçili günde işlem yok.
              </p>
            ) : (
              selectedDayEvents.map((event) => (
                <article
                  key={`${event.applicationId}-${event.happenedAtMs}-${event.actionType}`}
                  className="rounded-md border border-border/50 bg-muted/20 p-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {event.customerName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {event.actionType} · {describeActivity(event)}
                      </p>
                    </div>
                    <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
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
              ))
            )}
          </div>

          <div className="mt-4 border-t border-border/40 pt-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Aralıktaki Son İşlemler
            </p>
            <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
              {timelineEvents.slice(0, 16).map((event) => (
                <div
                  key={`recent-${event.applicationId}-${event.happenedAtMs}-${event.actionType}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background px-2.5 py-1.5"
                >
                  <p className="truncate text-[11px] text-muted-foreground">
                    {event.customerName}
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {event.happenedAtDate.toLocaleDateString("tr-TR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}{" "}
                    {formatTime(event.happenedAtDate)}
                  </p>
                </div>
              ))}
            </div>
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
  onStaffSelect?: (staffId: string) => void;
}) {
  const [monthValue, setMonthValue] = useState(() => formatMonthValue(new Date()));
  const [startDay, setStartDay] = useState(1);
  const [endDay, setEndDay] = useState(() => new Date().getDate());
  const [selectedDayKey, setSelectedDayKey] = useState(() => toDayKey(new Date()));

  const parsedMonth = useMemo(
    () =>
      parseMonthValue(monthValue) ?? {
        year: new Date().getFullYear(),
        monthIndex: new Date().getMonth(),
      },
    [monthValue],
  );

  const maxDay = useMemo(
    () => getDaysInMonth(parsedMonth.year, parsedMonth.monthIndex),
    [parsedMonth.monthIndex, parsedMonth.year],
  );

  useEffect(() => {
    setStartDay((current) => clampDay(current, maxDay));
    setEndDay((current) => clampDay(current, maxDay));
  }, [maxDay]);

  const rangeStartDay = Math.min(startDay, endDay);
  const rangeEndDay = Math.max(startDay, endDay);

  const rangeStartMs = useMemo(
    () => new Date(parsedMonth.year, parsedMonth.monthIndex, rangeStartDay).getTime(),
    [parsedMonth.monthIndex, parsedMonth.year, rangeStartDay],
  );
  const rangeEndMs = useMemo(
    () =>
      new Date(
        parsedMonth.year,
        parsedMonth.monthIndex,
        rangeEndDay,
        23,
        59,
        59,
        999,
      ).getTime(),
    [parsedMonth.monthIndex, parsedMonth.year, rangeEndDay],
  );

  const staffNameMap = useMemo(
    () =>
      new Map(
        [...salesProductivity, ...docProductivity].map((staff) => [
          staff.staffId,
          staff.fullName,
        ]),
      ),
    [docProductivity, salesProductivity],
  );

  const selectedStaffName = selectedStaffId
    ? staffNameMap.get(selectedStaffId) ?? "Bilinmeyen personel"
    : null;

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

  const filteredEvents = useMemo(() => {
    if (!selectedStaffId) {
      return [];
    }

    return normalizedEvents
      .filter((event) => event.staffId === selectedStaffId)
      .filter(
        (event) =>
          event.happenedAtMs >= rangeStartMs && event.happenedAtMs <= rangeEndMs,
      )
      .sort((a, b) => a.happenedAtMs - b.happenedAtMs);
  }, [normalizedEvents, rangeEndMs, rangeStartMs, selectedStaffId]);

  useEffect(() => {
    const selectedDate = parseDayKey(selectedDayKey);
    if (!selectedDate) {
      setSelectedDayKey(toDayKey(new Date(parsedMonth.year, parsedMonth.monthIndex, rangeStartDay)));
      return;
    }

    const sameMonth =
      selectedDate.getFullYear() === parsedMonth.year &&
      selectedDate.getMonth() === parsedMonth.monthIndex;
    const inRange =
      selectedDate.getDate() >= rangeStartDay &&
      selectedDate.getDate() <= rangeEndDay;

    if (!sameMonth || !inRange) {
      setSelectedDayKey(toDayKey(new Date(parsedMonth.year, parsedMonth.monthIndex, rangeStartDay)));
    }
  }, [parsedMonth.monthIndex, parsedMonth.year, rangeEndDay, rangeStartDay, selectedDayKey]);

  useEffect(() => {
    if (!selectedStaffId) {
      return;
    }

    if (filteredEvents.length === 0) {
      setSelectedDayKey(toDayKey(new Date(parsedMonth.year, parsedMonth.monthIndex, rangeStartDay)));
      return;
    }

    const exists = filteredEvents.some((event) => event.dayKey === selectedDayKey);
    if (!exists) {
      const latestEvent = filteredEvents[filteredEvents.length - 1];
      setSelectedDayKey(latestEvent.dayKey);
    }
  }, [filteredEvents, parsedMonth.monthIndex, parsedMonth.year, rangeStartDay, selectedDayKey, selectedStaffId]);

  const selectedDay = useMemo(
    () =>
      parseDayKey(selectedDayKey) ??
      new Date(parsedMonth.year, parsedMonth.monthIndex, rangeStartDay),
    [parsedMonth.monthIndex, parsedMonth.year, rangeStartDay, selectedDayKey],
  );

  const selectedDayEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => event.dayKey === selectedDayKey)
        .sort((a, b) => b.happenedAtMs - a.happenedAtMs),
    [filteredEvents, selectedDayKey],
  );

  const timelineEvents = useMemo(
    () => [...filteredEvents].sort((a, b) => b.happenedAtMs - a.happenedAtMs),
    [filteredEvents],
  );

  const daysWithActivity = useMemo(
    () =>
      Array.from(new Set(filteredEvents.map((event) => event.dayKey)))
        .map(parseDayKey)
        .filter((event): event is Date => Boolean(event)),
    [filteredEvents],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ActivityCalendarPanel
        selectedStaffName={selectedStaffName}
        selectedStaffId={selectedStaffId}
        monthValue={monthValue}
        onMonthChange={(value) => {
          if (!value) {
            return;
          }
          setMonthValue(value);
        }}
        startDay={startDay}
        endDay={endDay}
        maxDay={maxDay}
        onStartDayChange={setStartDay}
        onEndDayChange={setEndDay}
        onResetRange={() => {
          setStartDay(1);
          setEndDay(maxDay);
        }}
        selectedDay={selectedDay}
        onSelectedDayChange={(value) => setSelectedDayKey(toDayKey(value))}
        daysWithActivity={daysWithActivity}
        filteredCount={filteredEvents.length}
      />
      <ProductivityChart
        title="Satış Verimliliği"
        description="Satış personeli bazında alınan ve işlenen başvurular."
        rows={salesProductivity}
        selectedStaffId={selectedStaffId}
        onStaffSelect={onStaffSelect}
      />
      <ActivityTimelinePanel
        selectedStaffName={selectedStaffName}
        selectedStaffId={selectedStaffId}
        selectedDay={selectedDay}
        selectedDayEvents={selectedDayEvents}
        timelineEvents={timelineEvents}
      />
      <ProductivityChart
        title="Evrak Verimliliği"
        description="Evrak personeli bazında alınan ve işlenen başvurular."
        rows={docProductivity}
        selectedStaffId={selectedStaffId}
        onStaffSelect={onStaffSelect}
      />
    </div>
  );
}
