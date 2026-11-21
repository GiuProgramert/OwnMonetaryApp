"use client";

import Link from "next/link";
import { useRef, type RefObject } from "react";
import {
  ArrowLeftRight,
  Pencil,
  Receipt,
  Tag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { formatEventDay, splitMovementDate } from "@/lib/movements/calendar";
import { Movement } from "@/lib/schemas/movements";
import { cn } from "@/lib/utils";
import {
  movementTime,
  signedAmount,
} from "@/components/movements/calendar/calendar-event";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

interface Props {
  movement: Movement;
  anchorRef: RefObject<HTMLElement | null>;
  side: "right" | "bottom";
  onClose: () => void;
  editHref: string;
  deleteHref: string;
}

export default function EventDetailsPopover({
  movement,
  anchorRef,
  side,
  onClose,
  editHref,
  deleteHref,
}: Props) {
  // Ancla de ESTE popover: al desmontarse por otro bloque, `anchorRef.current` ya apunta al nuevo.
  const ownAnchor = useRef(anchorRef.current).current;
  const { day, isAllDay } = splitMovementDate(movement.date);
  const amountColor =
    movement.type === "credit"
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {/* virtualRef tipado como RefObject<Measurable>; un HTMLElement lo cumple. */}
      <PopoverAnchor
        virtualRef={anchorRef as RefObject<HTMLElement>}
      />
      <PopoverContent
        side={side}
        align="start"
        collisionPadding={16}
        hideWhenDetached
        className="w-72 p-4"
        aria-label={movement.description}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Si otro bloque tomó el ancla, enfocar este movería el foco fuera del popover nuevo.
          if (anchorRef.current === ownAnchor) {
            ownAnchor?.focus();
          }
        }}
      >
        <div className="-mt-2 -mr-2 mb-2 flex justify-end gap-0.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Editar"
            title="Editar"
          >
            <Link href={editHref}>
              <Pencil />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Eliminar"
            title="Eliminar"
          >
            <Link href={deleteHref}>
              <Trash2 />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span
              className="mt-2 size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: movement.movement_types.color }}
            />
            <h3 className="text-lg leading-snug font-medium break-words">
              {movement.description}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {`${formatEventDay(day)} · ${isAllDay ? "Sin hora" : movementTime(movement)}`}
          </p>
          <p className={cn("text-base font-semibold", amountColor)}>
            {signedAmount(movement)}
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 shrink-0 text-muted-foreground" />
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: movement.accounts.color }}
              />
              <span>{movement.accounts.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="size-4 shrink-0 text-muted-foreground" />
              <span>{movement.movement_types.name}</span>
            </div>
            {movement.transfer_id && (
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="size-4 shrink-0 text-muted-foreground" />
                <span>Transferencia</span>
              </div>
            )}
            {movement.debts && (
              <div className="flex items-center gap-2">
                <Receipt className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  {"Pago de "}
                  <Link
                    href={`/protected/debts/${movement.debts.id}`}
                    className="underline"
                  >
                    {movement.debts.name}
                  </Link>
                </span>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
