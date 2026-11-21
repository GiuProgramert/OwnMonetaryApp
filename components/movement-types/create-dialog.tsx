"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CreateMovementTypeForm from "@/components/movement-types/create-form";
import { MovementType } from "@/lib/schemas/movement-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onCreated: (type: MovementType) => void;
}

export default function CreateMovementTypeDialog({
  open,
  onOpenChange,
  defaultName,
  onCreated,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo tipo de movimiento</DialogTitle>
          <DialogDescription>
            Al crearlo queda seleccionado en el movimiento.
          </DialogDescription>
        </DialogHeader>
        <CreateMovementTypeForm
          key={defaultName}
          defaultName={defaultName}
          onCreated={onCreated}
          idPrefix="new-type-"
        />
      </DialogContent>
    </Dialog>
  );
}
