"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMonthLabel, isCurrentMonth, shiftMonth } from "@/lib/budgets/month";

interface Props {
  month: string;
}

export default function BudgetsMonthFilter({ month }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const goTo = (value: string | undefined) => {
    router.push(value ? `${pathname}?month=${value}` : pathname);
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Mes anterior"
        onClick={() => goTo(shiftMonth(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <Input
        type="month"
        aria-label={getMonthLabel(month)}
        value={month}
        className="w-44"
        onChange={(e) => {
          if (e.target.value) {
            goTo(e.target.value);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Mes siguiente"
        onClick={() => goTo(shiftMonth(month, 1))}
      >
        <ChevronRight />
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isCurrentMonth(month)}
        onClick={() => goTo(undefined)}
      >
        Mes actual
      </Button>
      <span className="text-sm text-muted-foreground">{getMonthLabel(month)}</span>
    </div>
  );
}
