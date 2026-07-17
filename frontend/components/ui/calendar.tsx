"use client"

import * as React from "react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { tr } from "date-fns/locale"

import { cn } from "@/lib/utils"

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Pt",
  2: "Sa",
  3: "Ça",
  4: "Pe",
  5: "Cu",
  6: "Ct",
  0: "Pz",
}

export type CalendarProps = DayPickerProps & {
  fromYear?: number
  toYear?: number
}

function Calendar({
  className,
  classNames,
  fromYear = 1900,
  toYear = 2100,
  startMonth,
  endMonth,
  showOutsideDays = true,
  formatters,
  ...props
}: CalendarProps) {
  const resolvedStartMonth = React.useMemo(
    () => startMonth ?? new Date(fromYear, 0),
    [fromYear, startMonth]
  )

  const resolvedEndMonth = React.useMemo(
    () => endMonth ?? new Date(toYear, 11),
    [endMonth, toYear]
  )

  return (
    <DayPicker
      {...props}
      locale={tr}
      weekStartsOn={1}
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      startMonth={resolvedStartMonth}
      endMonth={resolvedEndMonth}
      navLayout="around"
      className={cn(
        "rounded-lg border border-[#cbb074] bg-[#fcf8f2] p-3 text-blue-950 shadow-sm",
        className
      )}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "relative flex items-center justify-center gap-2",
        caption_label: "text-sm font-semibold text-blue-950",
        dropdowns: "flex items-center gap-2",
        dropdown_root: "relative",
        dropdown:
          "h-8 rounded-md border border-[#cbb074] bg-[#fffaf0] px-2 text-sm font-medium text-blue-950 outline-none focus-visible:border-blue-950",
        years_dropdown: "h-8",
        months_dropdown: "h-8",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#cbb074] bg-[#fffaf0] text-blue-950 transition-colors hover:bg-[#f3e6c5]",
        button_next:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#cbb074] bg-[#fffaf0] text-blue-950 transition-colors hover:bg-[#f3e6c5]",
        chevron: "h-4 w-4 fill-blue-950",
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7 gap-1",
        weekday:
          "flex h-8 items-center justify-center text-xs font-semibold text-blue-950",
        weeks: "mt-1 grid gap-1",
        week: "grid grid-cols-7 gap-1",
        day: "flex h-9 w-9 items-center justify-center p-0",
        day_button:
          "h-9 w-9 rounded-md text-sm font-medium text-blue-950 transition-colors hover:bg-[#f3e6c5] focus-visible:border-blue-950 focus-visible:ring-2 focus-visible:ring-blue-950/35 aria-selected:bg-blue-950 aria-selected:text-white",
        selected: "bg-blue-950 text-white",
        today: "font-semibold text-blue-950",
        outside: "text-blue-950/45",
        disabled: "text-blue-950/30",
        hidden: "invisible",
        footer: "mt-2",
        ...classNames,
      }}
      formatters={{
        formatWeekdayName: (date) => WEEKDAY_LABELS[date.getDay()] ?? "",
        ...formatters,
      }}
    />
  )
}

export { Calendar }
