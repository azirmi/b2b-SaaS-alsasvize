"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { STAGE_LABEL } from "@/lib/status";
import type { StageCount, StaffPerformance } from "@/lib/types";

// Monochrome only — bars are drawn from neutral tokens (foreground / muted).
const stageConfig = {
  count: { label: "Applications", color: "var(--foreground)" },
} satisfies ChartConfig;

const staffConfig = {
  claimed: { label: "Claimed", color: "var(--muted-foreground)" },
  processed: { label: "Processed", color: "var(--foreground)" },
} satisfies ChartConfig;

export function AdminStatsCharts({
  byStage,
  staffPerformance,
}: {
  byStage: StageCount[];
  staffPerformance: StaffPerformance[];
}) {
  const stageData = byStage.map((row) => ({
    stage: STAGE_LABEL[row.stage],
    count: row.count,
  }));
  const staffData = staffPerformance.map((row) => ({
    name: row.fullName,
    claimed: row.claimed,
    processed: row.processed,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium">Applications per stage</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Distribution across the pipeline.
        </p>
        <ChartContainer config={stageConfig} className="mt-4 h-60 w-full">
          <BarChart data={stageData} margin={{ left: -16, top: 8, right: 8 }}>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="stage"
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={70}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={28}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </section>

      <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium">Staff productivity</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Applications claimed and stage transitions performed, per staff member.
        </p>
        {staffData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No staff activity recorded yet.
          </p>
        ) : (
          <ChartContainer config={staffConfig} className="mt-4 h-60 w-full">
            <BarChart data={staffData} margin={{ left: -16, top: 8, right: 8 }}>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-32}
                textAnchor="end"
                height={70}
                tick={{ fontSize: 10 }}
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
              <Bar dataKey="claimed" fill="var(--color-claimed)" radius={4} />
              <Bar dataKey="processed" fill="var(--color-processed)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </section>
    </div>
  );
}
