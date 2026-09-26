import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import getMovements from "@/lib/services/movements";
import { MovementFilter } from "@/lib/schemas/movements";
import { formatCurrency } from "@/lib/dashboard/format";

interface Props {
  filter: MovementFilter;
}

const TOP_COUNT = 5;

export default async function TopExpensesCard({ filter }: Props) {
  const { data } = await getMovements(filter, { orderBy: "amount", type: "debit" });
  const topExpenses = data
    .filter((movement) => !movement.transfer_id)
    .slice(0, TOP_COUNT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mayores gastos</CardTitle>
      </CardHeader>
      <CardContent>
        {topExpenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay gastos registrados en este período.
          </p>
        ) : (
          <ul className="space-y-3">
            {topExpenses.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{movement.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(movement.date).toLocaleDateString("es-PY")} ·{" "}
                    {movement.movement_types.name}
                  </p>
                </div>
                <span className="font-medium text-red-500">
                  {formatCurrency(movement.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
