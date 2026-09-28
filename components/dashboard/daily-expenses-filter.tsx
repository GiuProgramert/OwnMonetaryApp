"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MAX_DAILY_RANGE_DAYS,
  enumerateDays,
  DailyExpensesPreset,
} from "@/lib/dashboard/date-range";

interface Props {
  preset: DailyExpensesPreset;
  startDate: string;
  endDate: string;
  showAllTypes: boolean;
  groupedCount: number;
}

export default function DailyExpensesFilter({
  preset,
  startDate,
  endDate,
  showAllTypes,
  groupedCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // "Personalizado" solo muestra los inputs; se navega recién con "Aplicar". Se resetea cuando
  // cambia el preset aplicado (por ejemplo, al volver atrás con el navegador).
  const [showCustom, setShowCustom] = useState(preset === "custom");
  const [prevPreset, setPrevPreset] = useState(preset);
  if (preset !== prevPreset) {
    setPrevPreset(preset);
    setShowCustom(preset === "custom");
  }

  const setParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    // `scroll: false`: el card está abajo en el dashboard y `router.push` sube al tope por defecto.
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const selectPreset = (value: "7d" | "30d") => {
    setShowCustom(false);
    setParams({ dailyRange: value, dailyStart: undefined, dailyEnd: undefined });
  };

  const applyCustomRange = (nextStart: string, nextEnd: string) => {
    setParams({ dailyRange: "custom", dailyStart: nextStart, dailyEnd: nextEnd });
  };

  const showCheckbox = groupedCount > 0 || showAllTypes;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={!showCustom && preset === "7d" ? "default" : "outline"}
          onClick={() => selectPreset("7d")}
        >
          7 días
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!showCustom && preset === "30d" ? "default" : "outline"}
          onClick={() => selectPreset("30d")}
        >
          1 mes
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showCustom ? "default" : "outline"}
          onClick={() => setShowCustom(true)}
        >
          Personalizado
        </Button>
      </div>

      {showCustom && (
        <CustomRangeInputs
          key={`${startDate}-${endDate}`}
          startDate={startDate}
          endDate={endDate}
          isApplied={preset === "custom"}
          onApply={applyCustomRange}
        />
      )}

      {showCheckbox && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="dailyTypes"
            checked={showAllTypes}
            onCheckedChange={(checked) =>
              setParams({ dailyTypes: checked ? "all" : undefined })
            }
          />
          <Label htmlFor="dailyTypes" className="text-sm font-normal">
            Ver todos los tipos
          </Label>
        </div>
      )}
    </div>
  );
}

/**
 * Borrador local del rango: se envía a la URL solo con "Aplicar" y si es válido. Se remonta con
 * `key={`${startDate}-${endDate}`}` desde el padre para resetearse cuando cambian las props
 * (por ejemplo, al volver atrás con el navegador), sin `useEffect`.
 */
function CustomRangeInputs({
  startDate,
  endDate,
  isApplied,
  onApply,
}: {
  startDate: string;
  endDate: string;
  /** El rango de las props ya es el personalizado aplicado (no el de un preset). */
  isApplied: boolean;
  onApply: (startDate: string, endDate: string) => void;
}) {
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [error, setError] = useState<string | undefined>(undefined);

  const isUnchanged = isApplied && draftStart === startDate && draftEnd === endDate;
  const canApply = Boolean(draftStart && draftEnd) && !isUnchanged;

  const apply = () => {
    if (draftStart > draftEnd) {
      setError("La fecha inicial es posterior a la final");
      return;
    }

    if (enumerateDays(draftStart, draftEnd).length > MAX_DAILY_RANGE_DAYS) {
      setError("El rango máximo es de 92 días");
      return;
    }

    setError(undefined);
    onApply(draftStart, draftEnd);
  };

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:max-w-lg">
        <div className="grid min-w-0 gap-1">
          <Label htmlFor="dailyStart" className="text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="dailyStart"
            type="date"
            value={draftStart}
            onChange={(e) => {
              setDraftStart(e.target.value);
              setError(undefined);
            }}
          />
        </div>
        <div className="grid min-w-0 gap-1">
          <Label htmlFor="dailyEnd" className="text-xs text-muted-foreground">
            Hasta
          </Label>
          <Input
            id="dailyEnd"
            type="date"
            value={draftEnd}
            onChange={(e) => {
              setDraftEnd(e.target.value);
              setError(undefined);
            }}
          />
        </div>
        <Button type="button" disabled={!canApply} onClick={apply}>
          Aplicar
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
