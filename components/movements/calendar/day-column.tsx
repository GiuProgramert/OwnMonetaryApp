"use client";

import { useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  EVENT_MINUTES,
  HOUR_HEIGHT,
  MAX_COLUMNS,
  layoutDayEvents,
  splitMovementDate,
} from "@/lib/movements/calendar";
import { Movement } from "@/lib/schemas/movements";
import { cn } from "@/lib/utils";
import CalendarEvent, {
  movementTime,
  signedAmount,
} from "@/components/movements/calendar/calendar-event";
import NowLine from "@/components/movements/calendar/now-line";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  day: string;
  /** Movimientos del día que no son "sin hora". */
  movements: Movement[];
  isToday: boolean;
  onOpen: (movement: Movement, anchor: HTMLElement) => void;
}

const GUTTER = 2;

interface ChipProps {
  top: number;
  hidden: { id: string; movement: Movement }[];
  height: number;
  onOpen: (movement: Movement, anchor: HTMLElement) => void;
}

function OverflowChip({ top, hidden, height, onOpen }: ChipProps) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={chipRef}
          type="button"
          className="absolute z-[5] flex items-center justify-center rounded-sm border bg-muted text-xs font-medium hover:bg-accent"
          style={{
            top: (top / 60) * HOUR_HEIGHT,
            height,
            left: `calc(${((MAX_COLUMNS - 1) / MAX_COLUMNS) * 100}% + ${GUTTER}px)`,
            width: `calc(${100 / MAX_COLUMNS}% - ${GUTTER * 2}px)`,
          }}
        >
          {`+${hidden.length}`}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        // Si el foco vuelve al chip, queda fuera del popover de detalle y lo cierra.
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <ul className="space-y-1">
          {hidden.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (chipRef.current) {
                    onOpen(item.movement, chipRef.current);
                  }
                }}
                className="block w-full rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
              >
                <span className="block truncate font-medium">
                  {item.movement.description}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {`${movementTime(item.movement)} · ${signedAmount(item.movement)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export default function DayColumn({
  day,
  movements,
  isToday,
  onOpen,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` });

  const { placed, overflow } = layoutDayEvents(
    movements.map((movement) => ({
      id: movement.id,
      minutes: splitMovementDate(movement.date).minutes,
      movement,
    }))
  );

  const height = (EVENT_MINUTES / 60) * HOUR_HEIGHT;

  return (
    <div
      ref={setNodeRef}
      data-day={day}
      className={cn("relative min-w-0 border-l", isOver && "bg-primary/5")}
      style={{ height: 24 * HOUR_HEIGHT }}
    >
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-border/60"
          style={{ top: hour * HOUR_HEIGHT }}
        />
      ))}
      {placed.map(({ event, column, columns }) => (
        <CalendarEvent
          key={event.id}
          movement={event.movement}
          onOpen={onOpen}
          className="absolute"
          style={{
            top: (event.minutes / 60) * HOUR_HEIGHT,
            height,
            left: `calc(${(column / columns) * 100}% + ${GUTTER}px)`,
            width: `calc(${100 / columns}% - ${GUTTER * 2}px)`,
          }}
        />
      ))}
      {overflow.map(({ top, hidden }) => (
        <OverflowChip
          key={`${top}-${hidden[0].id}`}
          top={top}
          hidden={hidden}
          height={height}
          onOpen={onOpen}
        />
      ))}
      {isToday && <NowLine />}
    </div>
  );
}
