"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCurrentMonthRange,
  getPreviousMonthRange,
  getLastNMonthsRange,
  getCurrentYearRange,
  DateRange,
} from "@/lib/dashboard/date-range";

interface Props {
  startDate: string | undefined;
  endDate: string | undefined;
  onChange: (range: { startDate: string | undefined; endDate: string | undefined }) => void;
}

const PRESETS: { label: string; getRange: () => DateRange }[] = [
  { label: "Mes actual", getRange: getCurrentMonthRange },
  { label: "Mes anterior", getRange: getPreviousMonthRange },
  { label: "Últimos 3 meses", getRange: () => getLastNMonthsRange(3) },
  { label: "Este año", getRange: getCurrentYearRange },
];

export default function DateRangeFilter({ startDate, endDate, onChange }: Props) {
  return (
    <div className="grid gap-2">
      <Label>Período</Label>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const range = preset.getRange();
          const active = range.startDate === startDate && range.endDate === endDate;
          return (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => onChange(range)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1">
          <Label htmlFor="startDate" className="text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="startDate"
            type="date"
            value={startDate ?? ""}
            onChange={(e) =>
              onChange({ startDate: e.target.value || undefined, endDate })
            }
          />
        </div>
        <div className="grid min-w-0 gap-1">
          <Label htmlFor="endDate" className="text-xs text-muted-foreground">
            Hasta
          </Label>
          <Input
            id="endDate"
            type="date"
            value={endDate ?? ""}
            onChange={(e) =>
              onChange({ startDate, endDate: e.target.value || undefined })
            }
          />
        </div>
      </div>
    </div>
  );
}
