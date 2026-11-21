"use client";

import { useState } from "react";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateString, parseDateString, toDateString } from "@/lib/dates";
import { nowForInput } from "@/lib/movements/datetime";
import { cn } from "@/lib/utils";

interface Props {
  id?: string;
  /** `YYYY-MM-DDTHH:mm` (lo que producía el `datetime-local`); también acepta `YYYY-MM-DD`. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Rango de años de los desplegables de mes/año. */
const START_MONTH = new Date(2000, 0);
const END_MONTH = new Date(new Date().getFullYear() + 10, 11);

/**
 * Fecha y hora en un solo campo: el botón muestra `21/11/2026, 11:03` y abre un `Popover` con el
 * `Calendar` de shadcn y la hora debajo. Elegir un día no cierra el popover (para poder ajustar la
 * hora); se cierra con "Listo", con Escape o al hacer clic afuera. Devuelve `YYYY-MM-DDTHH:mm`, el
 * mismo formato que el `datetime-local` que reemplaza, así que los esquemas Zod no cambian.
 */
export default function DateTimePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder = "Elegí fecha y hora",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const date = value.slice(0, 10);
  const time = value.slice(11, 16) || "00:00";
  const selected = parseDateString(date);

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
          className={cn(
            "w-full justify-start px-3 font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="text-muted-foreground" />
          {selected ? `${formatDateString(date)}, ${time}` : placeholder}
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
          onSelect={(day) => {
            if (day) {
              onChange(`${toDateString(day)}T${time}`);
            }
          }}
        />
        <div className="flex items-center gap-2 border-t p-3">
          <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            type="time"
            aria-label="Hora"
            value={time}
            onChange={(e) =>
              onChange(`${date || toDateString(new Date())}T${e.target.value || "00:00"}`)
            }
            className="h-8 flex-1 appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
          />
        </div>
        <div className="flex gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => onChange(nowForInput())}
          >
            Ahora
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1"
            onClick={() => {
              setOpen(false);
              onBlur?.();
            }}
          >
            Listo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
