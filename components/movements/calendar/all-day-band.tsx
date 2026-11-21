"use client";

import { useDroppable } from "@dnd-kit/core";
import { ALL_DAY_VISIBLE } from "@/lib/movements/calendar";
import { Movement } from "@/lib/schemas/movements";
import { cn } from "@/lib/utils";
import CalendarEvent from "@/components/movements/calendar/calendar-event";

interface CellProps {
  day: string;
  events: Movement[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: (movement: Movement, anchor: HTMLElement) => void;
}

function AllDayCell({ day, events, expanded, onToggle, onOpen }: CellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `allday:${day}` });
  const hasMore = events.length > ALL_DAY_VISIBLE;
  const visible = expanded ? events : events.slice(0, ALL_DAY_VISIBLE);

  return (
    <div
      ref={setNodeRef}
      data-allday={day}
      className={cn(
        "flex min-h-8 min-w-0 flex-col gap-0.5 border-l p-0.5",
        isOver && "bg-primary/10"
      )}
    >
      {visible.map((movement) => (
        <CalendarEvent
          key={movement.id}
          movement={movement}
          compact
          onOpen={onOpen}
        />
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={onToggle}
          className="text-left text-xs text-muted-foreground hover:underline"
        >
          {expanded
            ? "Mostrar menos"
            : `+${events.length - ALL_DAY_VISIBLE} más`}
        </button>
      )}
    </div>
  );
}

interface Props {
  days: string[];
  eventsByDay: Record<string, Movement[]>;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (movement: Movement, anchor: HTMLElement) => void;
  gridTemplateColumns: string;
}

export default function AllDayBand({
  days,
  eventsByDay,
  expanded,
  onToggle,
  onOpen,
  gridTemplateColumns,
}: Props) {
  return (
    <div className="grid border-b" style={{ gridTemplateColumns }}>
      <div className="flex items-start justify-end px-1 py-1 text-[10px] text-muted-foreground">
        Sin hora
      </div>
      {days.map((day) => (
        <AllDayCell
          key={day}
          day={day}
          events={eventsByDay[day] ?? []}
          expanded={expanded}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
