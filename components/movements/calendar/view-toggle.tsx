import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  view: "list" | "calendar";
  /** `accountFilter.param`: siempre explícito, la ausencia significa "cuenta principal". */
  accountParam: string;
  movementTypeId: string | undefined;
}

export default function MovementsViewToggle({
  view,
  accountParam,
  movementTypeId,
}: Props) {
  const params = new URLSearchParams();
  params.set("accountId", accountParam);

  if (movementTypeId) {
    params.set("movementTypeId", movementTypeId);
  }

  const listHref = `/protected/movements?${params.toString()}`;

  params.set("view", "calendar");
  const calendarHref = `/protected/movements?${params.toString()}`;

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant={view === "list" ? "default" : "outline"}>
        <Link href={listHref}>Lista</Link>
      </Button>
      <Button asChild variant={view === "calendar" ? "default" : "outline"}>
        <Link href={calendarHref}>Calendario</Link>
      </Button>
    </div>
  );
}
