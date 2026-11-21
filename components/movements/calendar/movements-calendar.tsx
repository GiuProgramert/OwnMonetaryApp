"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  HOUR_HEIGHT,
  INITIAL_SCROLL_HOUR,
  offsetToMinutes,
  splitMovementDate,
  toMovementDate,
} from "@/lib/movements/calendar";
import { withReturnTo } from "@/lib/return-to";
import { Movement } from "@/lib/schemas/movements";
import { updateMovementDate } from "@/lib/services/movements.client";
import { revalidatePathServer } from "@/lib/services/revalidate";
import { moveTransfer } from "@/lib/services/transfers.client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import AllDayBand from "@/components/movements/calendar/all-day-band";
import { EventBlock } from "@/components/movements/calendar/calendar-event";
import { DAY_LABELS } from "@/components/movements/calendar/day-labels";
import DayColumn from "@/components/movements/calendar/day-column";
import EventDetailsPopover from "@/components/movements/calendar/event-details-popover";
import MobileDayStrip from "@/components/movements/calendar/mobile-day-strip";

interface Props {
  movements: Movement[];
  days: string[];
  selectedDay: string;
  today: string;
}

type ActiveDrag = { movement: Movement; compact: boolean; width: number };

function dateKey(date: string): string {
  return date.replace(" ", "T").slice(0, 16);
}

export default function MovementsCalendar({
  movements,
  days,
  selectedDay,
  today,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [items, setItems] = useState(movements);
  const [previousMovements, setPreviousMovements] = useState(movements);
  const [active, setActive] = useState<ActiveDrag | null>(null);
  const [bandExpanded, setBandExpanded] = useState(false);
  const [selected, setSelected] = useState<Movement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  // Copia local para el movimiento optimista; se resetea cuando el server manda datos nuevos.
  if (previousMovements !== movements) {
    setPreviousMovements(movements);
    setItems(movements);
  }

  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const ready = isDesktop !== undefined;

  useEffect(() => {
    if (ready && scrollRef.current) {
      scrollRef.current.scrollTop = INITIAL_SCROLL_HOUR * HOUR_HEIGHT;
    }
  }, [ready]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  if (!ready) {
    return <Skeleton className="h-[70vh] w-full" />;
  }

  const visibleDays = isDesktop ? days : [selectedDay];
  const gridTemplateColumns = `56px repeat(${visibleDays.length}, minmax(0, 1fr))`;

  const eventsByDay: Record<string, Movement[]> = {};
  const allDayByDay: Record<string, Movement[]> = {};

  for (const movement of items) {
    const { day, isAllDay } = splitMovementDate(movement.date);
    const target = isAllDay ? allDayByDay : eventsByDay;
    (target[day] ??= []).push(movement);
  }

  const actionHref = (movement: Movement, action: "edit" | "delete") => {
    const query = searchParams.toString();
    const returnTo = query ? `${pathname}?${query}` : pathname;
    const base = movement.transfer_id
      ? `/protected/transfers/${action}/${movement.transfer_id}`
      : `/protected/movements/${action}/${movement.id}`;

    return withReturnTo(base, returnTo);
  };

  const onOpen = (movement: Movement, anchor: HTMLElement) => {
    // Después de un arrastre el navegador igual dispara `click` sobre el bloque.
    if (draggedRef.current) {
      return;
    }

    anchorRef.current = anchor;
    setSelected(movement);
  };

  const handleDragStart = (event: DragStartEvent) => {
    draggedRef.current = true;
    setSelected(null);
    const data = event.active.data.current as
      { movement: Movement; compact: boolean } | undefined;

    if (data) {
      setActive({
        movement: data.movement,
        compact: data.compact,
        width: event.active.rect.current.initial?.width ?? 0,
      });
    }
  };

  const releaseDragFlag = () => {
    setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActive(null);
    releaseDragFlag();

    const { active: dragged, over } = event;

    if (!over) {
      return;
    }

    const movement = items.find((item) => item.id === String(dragged.id));

    if (!movement) {
      return;
    }

    const overId = String(over.id);
    const separator = overId.indexOf(":");
    const kind = overId.slice(0, separator);
    const day = overId.slice(separator + 1);

    let minutes: number;

    if (kind === "day") {
      const column = gridRef.current?.querySelector(`[data-day="${day}"]`);
      const draggedTop = dragged.rect.current.translated?.top;

      if (!column || draggedTop === undefined) {
        return;
      }

      minutes = offsetToMinutes(
        draggedTop - column.getBoundingClientRect().top,
      );
    } else if (kind === "allday") {
      minutes = 0;
    } else if (kind === "strip") {
      minutes = splitMovementDate(movement.date).minutes;
    } else {
      return;
    }

    const newDate = toMovementDate(day, minutes);

    if (newDate === dateKey(movement.date)) {
      return;
    }

    const previous = items;

    // Optimista; una transferencia mueve las dos patas si se ven las dos.
    setItems(
      items.map((item) =>
        item.id === movement.id ||
        (movement.transfer_id && item.transfer_id === movement.transfer_id)
          ? { ...item, date: newDate }
          : item,
      ),
    );

    try {
      if (movement.transfer_id) {
        await moveTransfer(movement.transfer_id, newDate);
      } else {
        await updateMovementDate(movement.id, newDate);
      }
    } catch {
      setItems(previous);
      toast.error("No se pudo mover el movimiento");
      return;
    }

    await revalidatePathServer("/protected/movements");
    router.refresh();
  };

  // Raíz propia: el `DragOverlay` (y los nodos de accesibilidad de dnd-kit) son hermanos de la
  // grilla, y dentro del `space-y-3` de `CalendarView` heredaban un `margin-top` de 12 px que
  // desplazaba el overlay respecto del bloque original.
  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActive(null);
          releaseDragFlag();
        }}
      >
        <div
          ref={gridRef}
          className="overflow-hidden rounded-md border bg-card"
        >
          {!isDesktop && (
            <MobileDayStrip days={days} selectedDay={selectedDay} />
          )}
          <div className="grid border-b" style={{ gridTemplateColumns }}>
            <div />
            {visibleDays.map((day) => {
              const index = days.indexOf(day);

              return (
                <div
                  key={day}
                  className="flex flex-col items-center gap-0.5 border-l py-1.5"
                >
                  <span className="text-xs text-muted-foreground">
                    {DAY_LABELS[index]}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-sm font-medium",
                      day === today && "bg-primary text-primary-foreground",
                    )}
                  >
                    {Number(day.slice(8, 10))}
                  </span>
                </div>
              );
            })}
          </div>
          <AllDayBand
            days={visibleDays}
            eventsByDay={allDayByDay}
            expanded={bandExpanded}
            onToggle={() => setBandExpanded((value) => !value)}
            onOpen={onOpen}
            gridTemplateColumns={gridTemplateColumns}
          />
          <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
            <div className="grid" style={{ gridTemplateColumns }}>
              <div className="relative" style={{ height: 24 * HOUR_HEIGHT }}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className={cn(
                      "absolute right-1 text-[10px] text-muted-foreground",
                      hour > 0 && "-translate-y-1/2",
                    )}
                    style={{ top: hour * HOUR_HEIGHT }}
                  >
                    {`${String(hour).padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>
              {visibleDays.map((day) => (
                <DayColumn
                  key={day}
                  day={day}
                  movements={eventsByDay[day] ?? []}
                  isToday={day === today}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {active && (
            <EventBlock
              movement={active.movement}
              compact={active.compact}
              style={{
                width: active.width,
                height: active.compact ? undefined : 32,
              }}
              className="shadow-md"
            />
          )}
        </DragOverlay>
      </DndContext>
      {selected && (
        <EventDetailsPopover
          key={selected.id}
          movement={selected}
          anchorRef={anchorRef}
          side={isDesktop ? "right" : "bottom"}
          onClose={() => setSelected(null)}
          editHref={actionHref(selected, "edit")}
          deleteHref={actionHref(selected, "delete")}
        />
      )}
    </div>
  );
}
