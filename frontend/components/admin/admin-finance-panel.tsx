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
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-border/60 bg-muted/90 p-1 pr-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:w-fit md:overflow-visible md:pr-1">
          {periods.map((period) => (
            <TabsTrigger key={period} value={period} className="flex-none">
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-3 py-3.5 sm:px-5">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-border/60 bg-muted/90 p-1 pr-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:w-fit sm:overflow-visible sm:pr-1">
              <TabsTrigger value="pending" className="flex-none">
                Kalan Ödemeler
              </TabsTrigger>
              <TabsTrigger value="all" className="flex-none">
                Tüm İşlemler
              </TabsTrigger>
            </TabsList>
            <span className="text-xs text-muted-foreground tabular-nums">
              {data.pendingPayments.length} bekleyen · {data.allTransactions.length} toplam işlem
            </span>
          </div>

          <TabsContent value="pending" className="mt-0">
            {data.pendingPayments.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground sm:px-5">
                Kalan ödeme bekleyen başvuru bulunmuyor.
              </div>
            ) : (
              <>
                <div className="space-y-3 px-3 py-4 md:hidden">
                  {data.pendingPayments.map((row) => (
                    <article
                      key={row.applicationId}
                      className="rounded-lg border border-border/40 bg-background p-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Danışan
                        </p>
                        <Link
                          href={`/dashboard/applications/${row.applicationId}`}
                          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {row.customerName}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground break-all">
                          {row.customerEmail}
                        </p>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Süreç Durumu
                          </p>
                          <StageBadge stage={row.currentStage} />
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Satış Tarihi
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(row.salesDate)}</p>
                        </div>
                      </div>

                      <dl className="mt-3 space-y-2 border-t border-border/30 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Toplam
                          </dt>
                          <dd className="text-sm tabular-nums">{formatTl(row.totalAmount)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Ön Ödeme
                          </dt>
                          <dd className="text-sm tabular-nums">{formatTl(row.upfrontPaid)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Kalan
                          </dt>
                          <dd className="text-sm font-medium tabular-nums text-amber-700 dark:text-amber-400">
                            {formatTl(row.remainingAmount)}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>

                <div className="hidden md:block">
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
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-0">
            {data.allTransactions.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground sm:px-5">
                İşlem kaydı bulunmuyor.
              </div>
            ) : (
              <>
                <div className="space-y-3 px-3 py-4 md:hidden">
                  {data.allTransactions.map((row) => (
                    <article
                      key={row.applicationId}
                      className="rounded-lg border border-border/40 bg-background p-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Danışan
                        </p>
                        <Link
                          href={`/dashboard/applications/${row.applicationId}`}
                          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {row.customerName}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground break-all">
                          {row.customerEmail}
                        </p>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Süreç Durumu
                          </p>
                          <StageBadge stage={row.currentStage} />
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Satış Tarihi
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(row.salesDate)}</p>
                        </div>
                      </div>

                      <dl className="mt-3 space-y-2 border-t border-border/30 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Toplam Tutar
                          </dt>
                          <dd className="text-sm tabular-nums">{formatTl(row.totalAmount)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Randevu Maliyeti
                          </dt>
                          <dd className="text-sm tabular-nums">{formatTl(row.appointmentExpense)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Net Kar
                          </dt>
                          <dd
                            className={cn(
                              "text-sm font-medium tabular-nums",
                              row.netProfit < 0
                                ? "text-red-700 dark:text-red-400"
                                : "text-emerald-700 dark:text-emerald-400",
                            )}
                          >
                            {formatTl(row.netProfit)}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>

                <div className="hidden md:block">
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
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
