"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateString, parseDateString, toDateString } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface Props {
  id?: string;
  /** `YYYY-MM-DD`, o `""` sin fecha. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Rango de años de los desplegables de mes/año: incluye fechas futuras (vencimientos). */
const START_MONTH = new Date(2000, 0);
const END_MONTH = new Date(new Date().getFullYear() + 10, 11);

/**
 * Selector de fecha (patrón Date Picker de shadcn: `Calendar` dentro de un `Popover`). Trabaja con
 * strings `YYYY-MM-DD` en hora local, igual que el `<input type="date">` que reemplaza, así que se
 * conecta a react-hook-form con un `Controller` sin cambiar el esquema Zod.
 */
export default function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder = "Elegí una fecha",
  disabled,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseDateString(value);

  const select = (date: Date) => {
    onChange(toDateString(date));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          onBlur?.();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "w-full justify-start px-3 font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="text-muted-foreground" />
          {selected ? formatDateString(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={START_MONTH}
          endMonth={END_MONTH}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              select(date);
            }
          }}
        />
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => select(new Date())}
          >
            Hoy
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
