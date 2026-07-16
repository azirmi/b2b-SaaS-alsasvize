"use client";

import Link from "next/link";

import { StageBadge } from "@/components/stage-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTl } from "@/lib/crm";
import type { AdminFinanceData, FinanceMetric } from "@/lib/types";
import { cn } from "@/lib/utils";

type FinancePeriod = "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_LABEL: Record<FinancePeriod, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
  yearly: "Yıllık",
};

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return "—";
  }
  return value.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function FinanceMetricCards({ metric }: { metric: FinanceMetric }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-border/40 bg-card p-4 shadow-sm">
        <p className="text-xs text-muted-foreground">Toplam Gelir</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {formatTl(metric.totalIncome)}
        </p>
      </div>
      <div className="rounded-lg border border-border/40 bg-card p-4 shadow-sm">
        <p className="text-xs text-muted-foreground">Toplam Gider</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {formatTl(metric.totalExpense)}
        </p>
      </div>
      <div className="rounded-lg border border-border/40 bg-card p-4 shadow-sm">
        <p className="text-xs text-muted-foreground">Net Kar</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
            metric.netProfit < 0
              ? "text-red-700 dark:text-red-400"
              : "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {formatTl(metric.netProfit)}
        </p>
      </div>
    </div>
  );
}

export function AdminFinancePanel({ data }: { data: AdminFinanceData }) {
  const periods = Object.keys(PERIOD_LABEL) as FinancePeriod[];

  return (
    <div className="space-y-4">
      <Tabs defaultValue="daily" className="gap-4">
        <TabsList>
          {periods.map((period) => (
            <TabsTrigger key={period} value={period}>
              {PERIOD_LABEL[period]}
            </TabsTrigger>
          ))}
        </TabsList>

        {periods.map((period) => (
          <TabsContent key={period} value={period}>
            <FinanceMetricCards metric={data.metrics[period]} />
          </TabsContent>
        ))}
      </Tabs>

      <section className="rounded-lg border border-border/40 bg-card shadow-sm">
        <Tabs defaultValue="pending" className="gap-0">
          <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
            <TabsList>
              <TabsTrigger value="pending">Kalan Ödemeler</TabsTrigger>
              <TabsTrigger value="all">Tüm İşlemler</TabsTrigger>
            </TabsList>
            <span className="text-xs text-muted-foreground tabular-nums">
              {data.pendingPayments.length} bekleyen · {data.allTransactions.length} toplam işlem
            </span>
          </div>

          <TabsContent value="pending" className="mt-0">
            {data.pendingPayments.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Kalan ödeme bekleyen başvuru bulunmuyor.
              </div>
            ) : (
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Danışan
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Süreç Durumu
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Toplam
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Ön Ödeme
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Kalan
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Satış Tarihi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pendingPayments.map((row) => (
                    <TableRow key={row.applicationId} className="border-border/40">
                      <TableCell>
                        <Link
                          href={`/dashboard/applications/${row.applicationId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {row.customerName}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.customerEmail}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={row.currentStage} />
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatTl(row.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatTl(row.upfrontPaid)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-amber-700 dark:text-amber-400">
                        {formatTl(row.remainingAmount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(row.salesDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-0">
            {data.allTransactions.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                İşlem kaydı bulunmuyor.
              </div>
            ) : (
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Danışan
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Süreç Durumu
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Toplam Tutar
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Randevu Maliyeti
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Net Kar
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Satış Tarihi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.allTransactions.map((row) => (
                    <TableRow key={row.applicationId} className="border-border/40">
                      <TableCell>
                        <Link
                          href={`/dashboard/applications/${row.applicationId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {row.customerName}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.customerEmail}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={row.currentStage} />
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatTl(row.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatTl(row.appointmentExpense)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-sm font-medium tabular-nums",
                          row.netProfit < 0
                            ? "text-red-700 dark:text-red-400"
                            : "text-emerald-700 dark:text-emerald-400",
                        )}
                      >
                        {formatTl(row.netProfit)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(row.salesDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
