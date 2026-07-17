"use client"

import * as React from "react"
import { format, isValid, parse } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarDays } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function parseIsoDate(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function formatIsoDate(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) {
    return ""
  }

  const pad = (num: number) => String(num).padStart(2, "0")
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function formatDisplayDate(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) {
    return ""
  }
  return format(value, "dd.MM.yyyy", { locale: tr })
}

function parseDisplayDate(value: string): Date | null {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    return null
  }

  const parsed = parse(value, "dd.MM.yyyy", new Date(), { locale: tr })
  if (!isValid(parsed)) {
    return null
  }

  return format(parsed, "dd.MM.yyyy", { locale: tr }) === value ? parsed : null
}

function maskDisplayDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8)

  if (digits.length <= 2) {
    return digits
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

interface BrandDatePickerInputProps {
  id: string
  value: string
  onChange: (nextValue: string) => void
  name?: string
  placeholder?: string
  required?: boolean
  min?: string
  disabled?: boolean
  className?: string
}

export function BrandDatePickerInput({
  id,
  value,
  onChange,
  name,
  placeholder = "GG.AA.YYYY",
  required,
  min,
  disabled,
  className,
}: BrandDatePickerInputProps) {
  const selectedDate = React.useMemo(() => parseIsoDate(value), [value])
  const minDate = React.useMemo(() => parseIsoDate(min ?? ""), [min])

  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState<Date>(selectedDate ?? new Date())
  const [displayValue, setDisplayValue] = React.useState<string>(
    formatDisplayDate(selectedDate)
  )

  React.useEffect(() => {
    const nextDisplay = formatDisplayDate(selectedDate)
    setDisplayValue(nextDisplay)
    if (selectedDate) {
      setMonth(selectedDate)
    }
  }, [selectedDate, value])

  function commitDate(nextDate: Date | null) {
    onChange(formatIsoDate(nextDate))
    setDisplayValue(formatDisplayDate(nextDate))
    if (nextDate) {
      setMonth(nextDate)
    }
  }

  function handleInputChange(nextRaw: string) {
    const masked = maskDisplayDateInput(nextRaw)
    setDisplayValue(masked)

    if (masked.length === 0) {
      onChange("")
      return
    }

    const parsed = parseDisplayDate(masked)
    if (parsed) {
      commitDate(parsed)
    }
  }

  function handleInputBlur() {
    if (!displayValue) {
      onChange("")
      return
    }

    const parsed = parseDisplayDate(displayValue)
    if (!parsed) {
      setDisplayValue("")
      onChange("")
      return
    }

    commitDate(parsed)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              id={id}
              value={displayValue}
              onChange={(event) => handleInputChange(event.target.value)}
              onBlur={handleInputBlur}
              onFocus={() => {
                if (!disabled) {
                  setOpen(true)
                }
              }}
              onClick={() => {
                if (!disabled) {
                  setOpen(true)
                }
              }}
              placeholder={placeholder}
              inputMode="numeric"
              required={required}
              disabled={disabled}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={cn("pr-9", className)}
            />

            <PopoverTrigger asChild>
              <button
                type="button"
                className="absolute top-1/2 right-2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center text-[#23345d] transition-colors hover:text-[#1f3f80]"
                aria-label="Takvimi aç"
                disabled={disabled}
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
              </button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>

        <PopoverContent className="w-auto p-2">
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(nextDate) => {
              commitDate(nextDate ?? null)
              if (nextDate) {
                setOpen(false)
              }
            }}
            month={month}
            onMonthChange={setMonth}
            fromYear={1900}
            toYear={2100}
            locale={tr}
          />

          <div className="mt-2 flex items-center justify-between border-t border-[#cbb074]/70 px-1 pt-2">
            <button
              type="button"
              className="text-xs font-medium text-[#23345d] underline-offset-4 transition-colors hover:text-[#1f3f80] hover:underline"
              onClick={() => {
                commitDate(null)
                setOpen(false)
              }}
            >
              Temizle
            </button>
            <button
              type="button"
              className="text-xs font-medium text-[#23345d] underline-offset-4 transition-colors hover:text-[#1f3f80] hover:underline"
              onClick={() => {
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                if (minDate && today < minDate) {
                  commitDate(minDate)
                  setOpen(false)
                  return
                }
                commitDate(today)
                setOpen(false)
              }}
            >
              Bugün
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {name ? <input type="hidden" name={name} value={value} /> : null}
    </>
  )
}
