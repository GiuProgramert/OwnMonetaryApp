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

  const setParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const selectPreset = (value: "7d" | "30d") => {
    setParams({ dailyRange: value, dailyStart: undefined, dailyEnd: undefined });
  };

  const selectCustom = () => {
    setParams({ dailyRange: "custom", dailyStart: startDate, dailyEnd: endDate });
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
          variant={preset === "7d" ? "default" : "outline"}
          onClick={() => selectPreset("7d")}
        >
          7 días
        </Button>
        <Button
          type="button"
          size="sm"
          variant={preset === "30d" ? "default" : "outline"}
          onClick={() => selectPreset("30d")}
        >
          1 mes
        </Button>
        <Button
          type="button"
          size="sm"
          variant={preset === "custom" ? "default" : "outline"}
          onClick={selectCustom}
        >
          Personalizado
        </Button>
      </div>

      {preset === "custom" && (
        <CustomRangeInputs
          key={`${startDate}-${endDate}`}
          startDate={startDate}
          endDate={endDate}
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
 * El estado local (borrador) solo se envía a la URL si el rango es válido. Se remonta con
 * `key={`${startDate}-${endDate}`}` desde el padre para resetearse cuando cambian las props
 * (por ejemplo, al volver atrás con el navegador), sin `useEffect`.
 */
function CustomRangeInputs({
  startDate,
  endDate,
  onApply,
}: {
  startDate: string;
  endDate: string;
  onApply: (startDate: string, endDate: string) => void;
}) {
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [error, setError] = useState<string | undefined>(undefined);

  const applyIfValid = (nextStart: string, nextEnd: string) => {
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);

    if (!nextStart || !nextEnd) {
      setError(undefined);
      return;
    }

    if (nextStart > nextEnd) {
      setError("La fecha inicial es posterior a la final");
      return;
    }

    if (enumerateDays(nextStart, nextEnd).length > MAX_DAILY_RANGE_DAYS) {
      setError("El rango máximo es de 92 días");
      return;
    }

    setError(undefined);
    onApply(nextStart, nextEnd);
  };

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:max-w-md">
        <div className="grid min-w-0 gap-1">
          <Label htmlFor="dailyStart" className="text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="dailyStart"
            type="date"
            value={draftStart}
            onChange={(e) => applyIfValid(e.target.value, draftEnd)}
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
            onChange={(e) => applyIfValid(draftStart, e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
