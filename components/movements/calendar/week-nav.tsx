import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  label: string;
  prevWeek: string;
  nextWeek: string;
  today: string;
  accountParam: string;
  movementTypeId: string | undefined;
}

export default function WeekNav({
  label,
  prevWeek,
  nextWeek,
  today,
  accountParam,
  movementTypeId,
}: Props) {
  // Cambiar de semana quita `day`: el día seleccionado vuelve a su default.
  const hrefFor = (week: string) => {
    const params = new URLSearchParams();
    params.set("view", "calendar");
    params.set("accountId", accountParam);

    if (movementTypeId) {
      params.set("movementTypeId", movementTypeId);
    }

    params.set("week", week);

    return `/protected/movements?${params.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="icon">
        <Link href={hrefFor(prevWeek)} aria-label="Semana anterior">
          <ChevronLeft />
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={hrefFor(today)}>Hoy</Link>
      </Button>
      <Button asChild variant="outline" size="icon">
        <Link href={hrefFor(nextWeek)} aria-label="Semana siguiente">
          <ChevronRight />
        </Link>
      </Button>
      <h2 className="ml-1 text-lg font-semibold">{label}</h2>
    </div>
  );
}
