"use client";

import { useDroppable } from "@dnd-kit/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DAY_LABELS } from "@/components/movements/calendar/day-labels";
import { cn } from "@/lib/utils";

function StripButton({
  day,
  index,
  selected,
  onSelect,
}: {
  day: string;
  index: number;
  selected: boolean;
  onSelect: (day: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `strip:${day}` });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(day)}
      className={cn(
        "rounded-md border px-1 py-1.5 text-xs font-medium",
        selected ? "bg-primary text-primary-foreground" : "bg-background",
        isOver && "ring-2 ring-primary"
      )}
    >
      {`${DAY_LABELS[index]} ${Number(day.slice(8, 10))}`}
    </button>
  );
}

interface Props {
  days: string[];
  selectedDay: string;
}

export default function MobileDayStrip({ days, selectedDay }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (day: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("day", day);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="grid grid-cols-7 gap-1 p-1">
      {days.map((day, index) => (
        <StripButton
          key={day}
          day={day}
          index={index}
          selected={day === selectedDay}
          onSelect={select}
        />
      ))}
    </div>
  );
}
