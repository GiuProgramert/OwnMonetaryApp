import Link from "next/link";
import { formatMovementDate } from "@/lib/movements/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import getMovements from "@/lib/services/movements";
import { MovementFilter } from "@/lib/schemas/movements";
import { formatCurrency } from "@/lib/dashboard/format";

interface Props {
  filter: MovementFilter;
  movementsHref: string;
}

const RECENT_COUNT = 5;

export default async function RecentMovementsCard({ filter, movementsHref }: Props) {
  const { data } = await getMovements(filter, { orderBy: "date" });
  const recent = data.slice(0, RECENT_COUNT);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Últimos movimientos</CardTitle>
        <Link href={movementsHref} className="text-sm text-muted-foreground hover:underline">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay movimientos registrados en este período.
          </p>
        ) : (
          <ul className="space-y-3">
            {recent.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{movement.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMovementDate(movement.date)} · {movement.accounts.name}
                  </p>
                </div>
                <Badge variant={movement.type === "credit" ? "default" : "destructive"}>
                  {formatCurrency(movement.amount)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
