"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

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
const pipelineConfig = {
  count: { label: "Applications", color: "var(--foreground)" },
} satisfies ChartConfig;

const productivityConfig = {
  claimed: { label: "Claimed", color: "var(--muted-foreground)" },
  processed: { label: "Processed", color: "var(--foreground)" },
} satisfies ChartConfig;

type ProductivityPoint = {
  staffId: string;
  name: string;
  claimed: number;
  processed: number;
};

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

function PipelineChart({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: StageCount[];
}) {
  const data = rows.map((row) => ({
    stage: STAGE_LABEL[row.stage],
    count: row.count,
  }));

  return (
    <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <ChartContainer config={pipelineConfig} className="mt-4 h-60 w-full">
        <BarChart data={data} margin={{ left: -16, top: 8, right: 8 }}>
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
          No staff activity recorded yet.
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

export function AdminStatsCharts({
  salesPipeline,
  salesProductivity,
  docPipeline,
  docProductivity,
  selectedStaffId,
  onStaffSelect,
}: {
  salesPipeline: StageCount[];
  salesProductivity: StaffPerformance[];
  docPipeline: StageCount[];
  docProductivity: StaffPerformance[];
  selectedStaffId?: string | null;
  onStaffSelect?: (staffId: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PipelineChart
        title="Sales Pipeline"
        description="Distribution across sales queue and in-progress stages."
        rows={salesPipeline}
      />
      <ProductivityChart
        title="Sales Productivity"
        description="Claims and processed transitions per Sales staff member."
        rows={salesProductivity}
        selectedStaffId={selectedStaffId}
        onStaffSelect={onStaffSelect}
      />
      <PipelineChart
        title="DOC Pipeline"
        description="Distribution across document queue and in-progress stages."
        rows={docPipeline}
      />
      <ProductivityChart
        title="DOC Productivity"
        description="Claims and processed transitions per DOC staff member."
        rows={docProductivity}
        selectedStaffId={selectedStaffId}
        onStaffSelect={onStaffSelect}
      />
    </div>
  );
}
