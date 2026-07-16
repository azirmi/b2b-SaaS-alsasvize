"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { APPLICATION_TYPE_LABEL } from "@/lib/application-type";
import { formatTl } from "@/lib/crm";
import type { AdminMasterTableRow, DeliveryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey =
  | "registrationDate"
  | "firstName"
  | "lastName"
  | "country"
  | "applicationType"
  | "totalAmount"
  | "appointment"
  | "deliveryStatus";
type SortDirection = "asc" | "desc";

type AppointmentFilter = "ALL" | "ALINDI" | "ALINMADI";
type PaymentFilter = "ALL" | "NORMAL" | "PREPAID";
type DeliveryFilter = "ALL" | DeliveryStatus;
type TypeFilter = "ALL" | AdminMasterTableRow["applicationType"];

type CountryFilter = "ALL" | string;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function appointmentState(row: AdminMasterTableRow): Exclude<AppointmentFilter, "ALL"> {
  return row.appointmentDate ? "ALINDI" : "ALINMADI";
}

function paymentTypeLabel(type: Exclude<PaymentFilter, "ALL">): string {
  return type === "NORMAL" ? "Pesin" : "On Odeme";
}

function deliveryLabel(status: DeliveryStatus): string {
  switch (status) {
    case "TESLIM_EDILDI":
      return "Teslim Edildi";
    case "BEKLIYOR":
      return "Bekliyor";
    case "EKSIK":
      return "Eksik Evrak";
    default:
      return status;
  }
}

function deliveryBadgeClass(status: DeliveryStatus): string {
  switch (status) {
    case "TESLIM_EDILDI":
      return "border-emerald-300/70 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-400";
    case "BEKLIYOR":
      return "border-amber-300/70 text-amber-700 dark:border-amber-700/60 dark:text-amber-400";
    case "EKSIK":
      return "border-red-300/70 text-red-700 dark:border-red-700/60 dark:text-red-400";
    default:
      return "";
  }
}

function receivedAmount(row: AdminMasterTableRow): number {
  if (row.paymentType === "PREPAID") {
    return row.upfrontPaid ?? 0;
  }
  return row.totalAmount;
}

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "Alinmadi";
  }
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return "Alindi";
  }
  return value.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return "-";
  }
  return value.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AdminMasterTable({ rows }: { rows: AdminMasterTableRow[] }) {
  const collator = useMemo(
    () =>
      new Intl.Collator("tr", {
        sensitivity: "base",
      }),
    [],
  );

  const countryOptions = useMemo(() => {
    const values = Array.from(
      new Set(rows.map((row) => normalizeText(row.country) || "Belirtilmedi")),
    );
    return values.sort((a, b) => collator.compare(a, b));
  }, [rows, collator]);

  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>("ALL");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("registrationDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    return rows.filter((row) => {
      const countryValue = normalizeText(row.country) || "Belirtilmedi";
      const paymentValue = row.paymentType;
      const appointmentValue = appointmentState(row);

      if (countryFilter !== "ALL" && countryValue !== countryFilter) {
        return false;
      }
      if (paymentFilter !== "ALL" && paymentValue !== paymentFilter) {
        return false;
      }
      if (appointmentFilter !== "ALL" && appointmentValue !== appointmentFilter) {
        return false;
      }
      if (deliveryFilter !== "ALL" && row.deliveryStatus !== deliveryFilter) {
        return false;
      }
      if (typeFilter !== "ALL" && row.applicationType !== typeFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        row.firstName,
        row.lastName,
        row.phone,
        countryValue,
        APPLICATION_TYPE_LABEL[row.applicationType],
        row.salesStaff ?? "",
        row.docStaff ?? "",
        row.appointmentNote ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedQuery);
    });
  }, [
    rows,
    query,
    countryFilter,
    paymentFilter,
    appointmentFilter,
    deliveryFilter,
    typeFilter,
  ]);

  const sortedRows = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1;
    const next = [...filteredRows];

    next.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case "registrationDate":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "firstName":
          comparison = collator.compare(a.firstName, b.firstName);
          break;
        case "lastName":
          comparison = collator.compare(a.lastName, b.lastName);
          break;
        case "country":
          comparison = collator.compare(
            normalizeText(a.country) || "Belirtilmedi",
            normalizeText(b.country) || "Belirtilmedi",
          );
          break;
        case "applicationType":
          comparison = collator.compare(
            APPLICATION_TYPE_LABEL[a.applicationType],
            APPLICATION_TYPE_LABEL[b.applicationType],
          );
          break;
        case "totalAmount":
          comparison = a.totalAmount - b.totalAmount;
          break;
        case "appointment":
          comparison = collator.compare(appointmentState(a), appointmentState(b));
          if (comparison === 0) {
            comparison =
              new Date(a.appointmentDate ?? 0).getTime() -
              new Date(b.appointmentDate ?? 0).getTime();
          }
          break;
        case "deliveryStatus":
          comparison = collator.compare(deliveryLabel(a.deliveryStatus), deliveryLabel(b.deliveryStatus));
          break;
      }

      if (comparison === 0) {
        comparison = collator.compare(a.applicationId, b.applicationId);
      }

      return comparison * factor;
    });

    return next;
  }, [filteredRows, sortDirection, sortKey, collator]);

  function resetFilters() {
    setQuery("");
    setCountryFilter("ALL");
    setPaymentFilter("ALL");
    setAppointmentFilter("ALL");
    setDeliveryFilter("ALL");
    setTypeFilter("ALL");
    setSortKey("registrationDate");
    setSortDirection("desc");
  }

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection(key === "registrationDate" ? "desc" : "asc");
      return;
    }

    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  }

  function renderSortIcon(key: SortKey) {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground" aria-hidden />;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 text-[#23345D]" aria-hidden />
    ) : (
      <ArrowDown className="h-3 w-3 text-[#23345D]" aria-hidden />
    );
  }

  return (
    <section className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Master Tablo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Operasyon verisinin filtrelenebilir ve siralanabilir ana gorunumu.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{sortedRows.length} kayit</span>
          <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Sifirla
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1 sm:w-[300px] sm:flex-none">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ad, telefon veya not ara"
            className="h-9 pl-8 text-sm"
          />
        </div>

        <Select value={countryFilter} onValueChange={(value) => setCountryFilter(value)}>
          <SelectTrigger className="h-9 w-[180px] text-sm">
            <SelectValue placeholder="Ulke" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tum ulkeler</SelectItem>
            {countryOptions.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
          <SelectTrigger className="h-9 w-[180px] text-sm">
            <SelectValue placeholder="Basvuru turu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tum basvuru turleri</SelectItem>
            {Object.entries(APPLICATION_TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={deliveryFilter} onValueChange={(value) => setDeliveryFilter(value as DeliveryFilter)}>
          <SelectTrigger className="h-9 w-[180px] text-sm">
            <SelectValue placeholder="Teslim durumu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tum teslim durumlari</SelectItem>
            <SelectItem value="TESLIM_EDILDI">Teslim Edildi</SelectItem>
            <SelectItem value="BEKLIYOR">Bekliyor</SelectItem>
            <SelectItem value="EKSIK">Eksik Evrak</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as PaymentFilter)}>
          <SelectTrigger className="h-9 w-[180px] text-sm">
            <SelectValue placeholder="Odeme tipi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tum odeme tipleri</SelectItem>
            <SelectItem value="NORMAL">Pesin</SelectItem>
            <SelectItem value="PREPAID">On Odemeli</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={appointmentFilter}
          onValueChange={(value) => setAppointmentFilter(value as AppointmentFilter)}
        >
          <SelectTrigger className="h-9 w-[180px] text-sm">
            <SelectValue placeholder="Randevu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tum randevu durumlari</SelectItem>
            <SelectItem value="ALINDI">Randevu Alindi</SelectItem>
            <SelectItem value="ALINMADI">Randevu Alinmadi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mx-auto w-full max-w-full">
        <Table className="w-max min-w-[1240px] table-auto border border-border/40 text-xs sm:text-sm [&_td]:whitespace-nowrap [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-1">
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/40 hover:bg-muted/40">
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("registrationDate")}
                  className="inline-flex w-full items-center gap-1 text-left hover:text-[#23345D]"
                >
                  <span>Kayit Tarihi</span>
                  {renderSortIcon("registrationDate")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("applicationType")}
                  className="inline-flex w-full items-center gap-1 text-left hover:text-[#23345D]"
                >
                  <span>Basvuru Turu</span>
                  {renderSortIcon("applicationType")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("firstName")}
                  className="inline-flex w-full items-center gap-1 text-left hover:text-[#23345D]"
                >
                  <span>Isim</span>
                  {renderSortIcon("firstName")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("lastName")}
                  className="inline-flex w-full items-center gap-1 text-left hover:text-[#23345D]"
                >
                  <span>Soyisim</span>
                  {renderSortIcon("lastName")}
                </button>
              </TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("country")}
                  className="inline-flex w-full items-center gap-1 text-left hover:text-[#23345D]"
                >
                  <span>Ulke</span>
                  {renderSortIcon("country")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("totalAmount")}
                  className="inline-flex w-full items-center gap-1 text-left hover:text-[#23345D]"
                >
                  <span>Satis & Alinan Odeme</span>
                  {renderSortIcon("totalAmount")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("deliveryStatus")}
                  className="inline-flex w-full items-center gap-1 text-left hover:text-[#23345D]"
                >
                  <span>Teslim Durumu</span>
                  {renderSortIcon("deliveryStatus")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("appointment")}
                  className="inline-flex w-full items-center gap-1 text-left hover:text-[#23345D]"
                >
                  <span>Randevu</span>
                  {renderSortIcon("appointment")}
                </button>
              </TableHead>
              <TableHead>Randevu Notu</TableHead>
              <TableHead>Danisman</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-20 px-2 py-1 text-center text-xs text-muted-foreground"
                >
                  Filtre sonucuna uygun kayit bulunamadi.
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => {
                const appointmentTaken = Boolean(row.appointmentDate);
                const paymentLabel = row.paymentType
                  ? paymentTypeLabel(row.paymentType)
                  : "-";

                return (
                  <TableRow key={row.applicationId} className="border-border/40">
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-md text-[11px]">
                        {APPLICATION_TYPE_LABEL[row.applicationType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{row.firstName || "-"}</TableCell>
                    <TableCell className="font-medium">{row.lastName || "-"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.phone || "-"}
                    </TableCell>
                    <TableCell>{row.country || "Belirtilmedi"}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        <p className="font-medium text-foreground">Satis: {formatTl(row.totalAmount)}</p>
                        <p className="text-muted-foreground">
                          Alinan: {row.paymentType ? formatTl(receivedAmount(row)) : "-"}
                        </p>
                        <p className="text-muted-foreground">{paymentLabel}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("rounded-md text-[11px]", deliveryBadgeClass(row.deliveryStatus))}
                      >
                        {deliveryLabel(row.deliveryStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md text-[11px]",
                            appointmentTaken
                              ? "border-emerald-300/70 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-400"
                              : "border-amber-300/70 text-amber-700 dark:border-amber-700/60 dark:text-amber-400",
                          )}
                        >
                          {appointmentTaken ? "Alindi" : "Alinmadi"}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{formatDateTime(row.appointmentDate)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="inline-block max-w-[20rem] truncate align-bottom">
                        {row.appointmentNote || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        <p>
                          <span className="text-muted-foreground">Satis:</span>{" "}
                          <span className="font-medium text-foreground">{row.salesStaff ?? "-"}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Evrak:</span>{" "}
                          <span className="font-medium text-foreground">{row.docStaff ?? "-"}</span>
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
