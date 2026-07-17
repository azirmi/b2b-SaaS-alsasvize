"use client";

import { useEffect, useMemo, useState } from "react";

import { DatePickerInput } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const BASE_INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30";

function isIsoTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function splitIsoDateTime(value: string): { date: string; time: string } {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return { date: "", time: "" };
  }
  const [date, time] = value.split("T");
  return { date, time };
}

function composeIsoDateTime(date: string, time: string): string {
  if (!date || !time || !isIsoTime(time)) {
    return "";
  }
  return `${date}T${time}`;
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
  placeholder = "DD.MM.YYYY",
  required,
  min,
  disabled,
  className,
}: LocalizedDatePickerInputProps) {
  return (
    <DatePickerInput
      id={id}
      value={value}
      onChange={onChange}
      name={name}
      placeholder={placeholder}
      required={required}
      min={min}
      disabled={disabled}
      className={cn(BASE_INPUT_CLASS, className)}
    />
  )
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
  placeholder = "DD.MM.YYYY",
  required,
  disabled,
  className,
}: LocalizedDateTimePickerInputProps) {
  const initial = useMemo(() => splitIsoDateTime(value), [value]);
  const [datePart, setDatePart] = useState(initial.date);
  const [timePart, setTimePart] = useState(initial.time);

  useEffect(() => {
    const next = splitIsoDateTime(value);
    setDatePart(next.date);
    setTimePart(next.time);
  }, [value]);

  function commit(nextDate: string, nextTime: string) {
    onChange(composeIsoDateTime(nextDate, nextTime));
  }

  return (
    <>
      <div className={cn("grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]", className)}>
        <DatePickerInput
          id={`${id}-date`}
          value={datePart}
          onChange={(nextDate) => {
            setDatePart(nextDate);
            commit(nextDate, timePart);
          }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={BASE_INPUT_CLASS}
        />

        <Input
          id={`${id}-time`}
          type="time"
          value={timePart}
          onChange={(event) => {
            const nextTime = event.target.value;
            setTimePart(nextTime);
            commit(datePart, nextTime);
          }}
          required={required}
          disabled={disabled}
          step={300}
          className={cn(BASE_INPUT_CLASS, "text-blue-950")}
        />
      </div>

      {name ? <input type="hidden" name={name} value={composeIsoDateTime(datePart, timePart)} /> : null}
    </>
  )
}
