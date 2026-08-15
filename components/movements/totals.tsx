import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMovementsTotals } from "@/lib/services/movements";
import { MovementFilter } from "@/lib/schemas/movements";

interface Props {
  filter: Omit<MovementFilter, "page">;
}

export default async function MovementsTotals({ filter }: Props) {
  const totals = await getMovementsTotals(filter);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Ingresos</CardTitle>
        </CardHeader>
        <CardContent className="text-xl font-semibold text-green-500">
          Gs. {totals.income.toLocaleString("es-PY")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Egresos</CardTitle>
        </CardHeader>
        <CardContent className="text-xl font-semibold text-red-500">
          Gs. {totals.expense.toLocaleString("es-PY")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Balance neto</CardTitle>
        </CardHeader>
        <CardContent
          className={`text-xl font-semibold ${
            totals.net >= 0 ? "text-green-500" : "text-red-500"
          }`}
        >
          Gs. {totals.net.toLocaleString("es-PY")}
        </CardContent>
      </Card>
    </div>
  );
}
