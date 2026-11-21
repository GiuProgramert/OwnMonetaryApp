"use client";

import { useState } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import { MovementType } from "@/lib/schemas/movement-types";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { filterMovementTypes, hasExactMatch } from "@/lib/movement-types/search";

interface Props {
  id?: string;
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
  value: string | undefined;
  onChange: (id: string) => void;
  onCreateRequest?: (name: string) => void;
  placeholder?: string;
}

export default function MovementTypeCombobox({
  id,
  movementTypes,
  value,
  onChange,
  onCreateRequest,
  placeholder = "Selecciona un tipo de movimiento",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = movementTypes.find((type) => type.id === value);
  const filtered = filterMovementTypes(movementTypes, query);
  const trimmed = query.trim();
  const showCreate =
    !!onCreateRequest && trimmed !== "" && !hasExactMatch(movementTypes, query);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          id={id}
          className="w-full justify-between"
        >
          {selected ? (
            <div className="flex items-center gap-2">
              <div
                style={{ backgroundColor: selected.color }}
                className="w-3 h-3 rounded-full shrink-0"
              />
              <span>{selected.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar tipo…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No se encontraron tipos</CommandEmpty>
            <CommandGroup>
              {filtered.map((type) => (
                <CommandItem
                  key={type.id}
                  value={type.id}
                  onSelect={() => {
                    onChange(type.id);
                    handleOpenChange(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{ backgroundColor: type.color }}
                      className="w-3 h-3 rounded-full shrink-0"
                    />
                    <span>{type.name}</span>
                  </div>
                </CommandItem>
              ))}
              {showCreate && (
                <CommandItem
                  value="__create__"
                  onSelect={() => {
                    handleOpenChange(false);
                    onCreateRequest?.(trimmed);
                  }}
                >
                  <Plus className="size-4" />
                  <span>Crear «{trimmed}»</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
