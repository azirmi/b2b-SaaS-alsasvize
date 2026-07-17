"use client"

import * as React from "react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { enUS } from "date-fns/locale"

import { cn } from "@/lib/utils"

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
      locale={enUS}
      weekStartsOn={0}
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      startMonth={resolvedStartMonth}
      endMonth={resolvedEndMonth}
      navLayout="around"
      className={cn(
        "rounded-md border border-slate-300 bg-white p-3 text-slate-900 shadow-sm",
        className
      )}
      classNames={{
        months: "flex flex-col",
        month: "space-y-4",
        month_caption: "flex items-start justify-between gap-2",
        caption_label: "sr-only",
        dropdowns: "flex items-center gap-1",
        dropdown_root: "relative",
        dropdown:
          "h-auto border-0 bg-transparent p-0 text-lg font-medium text-slate-900 outline-none focus-visible:ring-0",
        years_dropdown: "",
        months_dropdown: "",
        nav: "flex flex-col items-center gap-1",
        button_previous:
          "inline-flex h-6 w-6 items-center justify-center rounded-sm text-slate-700 transition-colors hover:bg-slate-100 [&>svg]:rotate-90",
        button_next:
          "inline-flex h-6 w-6 items-center justify-center rounded-sm text-slate-700 transition-colors hover:bg-slate-100 [&>svg]:rotate-90",
        chevron: "h-4 w-4 fill-slate-700",
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7 gap-1",
        weekday:
          "flex h-8 items-center justify-center text-sm font-semibold text-slate-900",
        weeks: "grid gap-1",
        week: "grid grid-cols-7 gap-1",
        day: "h-9 w-9 p-0",
        day_button:
          "h-9 w-9 rounded-none text-sm font-normal text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6]/30 aria-selected:bg-[#0b63f6] aria-selected:text-white aria-selected:font-semibold aria-selected:hover:bg-[#0b63f6]",
        selected: "bg-[#0b63f6] text-white rounded-none font-semibold",
        today: "font-semibold text-slate-900",
        outside: "text-slate-400",
        disabled: "text-slate-300",
        hidden: "invisible",
        footer: "mt-2",
        ...classNames,
      }}
    />
  )
}

export { Calendar }
