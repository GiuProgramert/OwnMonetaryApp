"use client";

import { useDraggable } from "@dnd-kit/core";
import { ArrowLeftRight } from "lucide-react";
import { formatMinutes, splitMovementDate } from "@/lib/movements/calendar";
import { Movement } from "@/lib/schemas/movements";
import { cn } from "@/lib/utils";

export function signedAmount(movement: Movement): string {
  const sign = movement.type === "credit" ? "+" : "−";

  return `${sign}Gs. ${Number(movement.amount).toLocaleString("es-PY")}`;
}

export function movementTime(movement: Movement): string {
  return formatMinutes(splitMovementDate(movement.date).minutes);
}

interface BlockProps {
  movement: Movement;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** Solo dibuja: lo usan el bloque arrastrable y el `DragOverlay`. */
export function EventBlock({ movement, compact, className, style }: BlockProps) {
  const color = movement.movement_types.color;
  const amountColor =
    movement.type === "credit"
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div
      style={{
        borderLeftColor: color,
        backgroundColor: `${color}26`,
        ...style,
      }}
      className={cn(
        "overflow-hidden rounded-sm border-l-4 px-1 text-xs leading-tight text-foreground",
        compact ? "flex items-center gap-1 py-0.5" : "h-full py-0.5",
        className
      )}
    >
      {compact ? (
        <>
          {movement.transfer_id && <ArrowLeftRight className="size-3 shrink-0" />}
          <span className="min-w-0 flex-1 truncate font-medium">
            {movement.description}
          </span>
          <span className={cn("shrink-0", amountColor)}>
            {signedAmount(movement)}
          </span>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1 font-medium">
            {movement.transfer_id && (
              <ArrowLeftRight className="size-3 shrink-0" />
            )}
            <span className="truncate">{movement.description}</span>
          </div>
          <div className={cn("truncate", amountColor)}>
            {`${movementTime(movement)} · ${signedAmount(movement)}`}
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  movement: Movement;
  compact?: boolean;
  onOpen: (movement: Movement) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function CalendarEvent({
  movement,
  compact,
  onOpen,
  className,
  style,
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: movement.id,
    data: { movement, compact: Boolean(compact) },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-movement-id={movement.id}
      aria-label={`${movement.description}, ${movementTime(movement)}, ${signedAmount(movement)}`}
      onClick={() => onOpen(movement)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpen(movement);
        }
      }}
      style={style}
      className={cn(
        "cursor-grab select-none",
        isDragging && "opacity-50",
        className
      )}
    >
      <EventBlock movement={movement} compact={compact} />
    </div>
  );
}
