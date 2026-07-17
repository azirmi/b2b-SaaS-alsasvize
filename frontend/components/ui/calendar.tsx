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
  locale = tr,
  captionLayout = "dropdown",
  fromYear = 1900,
  toYear = 2100,
  startMonth,
  endMonth,
  weekStartsOn = 1,
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
      locale={locale}
      weekStartsOn={weekStartsOn}
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      startMonth={resolvedStartMonth}
      endMonth={resolvedEndMonth}
      navLayout="after"
      className={cn(
        "rounded-lg border border-[#cbb074] bg-[#fdfaf3] p-3 text-[#23345d] shadow-sm",
        className
      )}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "relative flex items-center justify-center gap-2",
        caption_label: "text-sm font-semibold text-[#23345d]",
        dropdowns: "flex items-center gap-2",
        dropdown_root: "relative",
        dropdown:
          "h-8 rounded-md border border-[#cbb074] bg-[#fffaf0] px-2 text-sm font-medium text-[#23345d] outline-none focus-visible:border-[#23345d]",
        years_dropdown: "h-8",
        months_dropdown: "h-8",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#cbb074] bg-[#fffaf0] text-[#23345d] transition-colors hover:bg-[#f3e6c5]",
        button_next:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#cbb074] bg-[#fffaf0] text-[#23345d] transition-colors hover:bg-[#f3e6c5]",
        chevron: "h-4 w-4 fill-[#23345d]",
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7 gap-1",
        weekday:
          "flex h-8 items-center justify-center text-xs font-semibold text-[#23345d]",
        weeks: "mt-1 grid gap-1",
        week: "grid grid-cols-7 gap-1",
        day: "flex h-9 w-9 items-center justify-center p-0",
        day_button:
          "h-9 w-9 rounded-md text-sm font-medium text-[#23345d] transition-colors hover:bg-[#f3e6c5] focus-visible:border-[#23345d] focus-visible:ring-2 focus-visible:ring-[#23345d]/35 aria-selected:bg-[#1f3f80] aria-selected:text-white",
        selected: "bg-[#1f3f80] text-white",
        today: "font-semibold text-[#1f3f80]",
        outside: "text-[#23345d]/45",
        disabled: "text-[#23345d]/30",
        hidden: "invisible",
        footer: "mt-2",
        ...classNames,
      }}
      formatters={{
        formatWeekdayName: (date) => WEEKDAY_LABELS[date.getDay()] ?? "",
        ...formatters,
      }}
      {...props}
    />
  )
}

export { Calendar }
