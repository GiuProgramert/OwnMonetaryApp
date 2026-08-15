"use client";

import { MovementType } from "@/lib/schemas/movement-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  id?: string;
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
}

export default function MovementTypeSelect({
  id,
  movementTypes,
  value,
  onChange,
  placeholder = "Selecciona un tipo de movimiento",
  allLabel,
}: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
        {movementTypes.map((movementType) => (
          <SelectItem key={movementType.id} value={movementType.id}>
            <div className="flex items-center gap-2">
              <div
                style={{ backgroundColor: movementType.color }}
                className="w-3 h-3 rounded-full shrink-0"
              />
              <span>{movementType.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
