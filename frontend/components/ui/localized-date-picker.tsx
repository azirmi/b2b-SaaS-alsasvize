"use client";

import DatePicker, { registerLocale } from "react-datepicker";
import { tr } from "date-fns/locale";

import { cn } from "@/lib/utils";

registerLocale("tr", tr);

const BASE_INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30";

function parseIsoDate(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatIsoDate(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) {
    return "";
  }

  const pad = (num: number) => String(num).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function parseIsoDateTime(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function formatIsoDateTime(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) {
    return "";
  }

  const pad = (num: number) => String(num).padStart(2, "0");
  const datePart = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const timePart = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return `${datePart}T${timePart}`;
}

interface LocalizedDatePickerInputProps {
  id: string;
  value: string;
  onChange: (nextValue: string) => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  disabled?: boolean;
  className?: string;
}

export function LocalizedDatePickerInput({
  id,
  value,
  onChange,
  name,
  placeholder = "dd/MM/yyyy",
  required,
  min,
  disabled,
  className,
}: LocalizedDatePickerInputProps) {
  const selected = parseIsoDate(value);
  const minDate = parseIsoDate(min ?? "");

  return (
    <>
      <DatePicker
        id={id}
        selected={selected}
        onChange={(nextDate: Date | null) => onChange(formatIsoDate(nextDate))}
        locale="tr"
        dateFormat="dd/MM/yyyy"
        placeholderText={placeholder}
        minDate={minDate ?? undefined}
        required={required}
        disabled={disabled}
        calendarStartDay={1}
        className={cn(BASE_INPUT_CLASS, className)}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}

interface LocalizedDateTimePickerInputProps {
  id: string;
  value: string;
  onChange: (nextValue: string) => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function LocalizedDateTimePickerInput({
  id,
  value,
  onChange,
  name,
  placeholder = "dd/MM/yyyy HH:mm",
  required,
  disabled,
  className,
}: LocalizedDateTimePickerInputProps) {
  const selected = parseIsoDateTime(value);

  return (
    <>
      <DatePicker
        id={id}
        selected={selected}
        onChange={(nextDate: Date | null) => onChange(formatIsoDateTime(nextDate))}
        locale="tr"
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={5}
        dateFormat="dd/MM/yyyy HH:mm"
        placeholderText={placeholder}
        required={required}
        disabled={disabled}
        calendarStartDay={1}
        className={cn(BASE_INPUT_CLASS, className)}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}
