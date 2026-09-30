import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getExpensesByMovementType } from "@/lib/services/dashboard";
import ExpensesByTypeChart from "@/components/dashboard/expenses-by-type-chart";
import { getExcludedFromExpenseChartsTypeNames } from "@/lib/services/movement-types";
import { DashboardFilter } from "@/lib/schemas/dashboard";

interface Props {
  filter: DashboardFilter;
}

export default async function ExpensesByTypeCard({ filter }: Props) {
  const [expenses, excludedNames] = await Promise.all([
    getExpensesByMovementType(filter),
    getExcludedFromExpenseChartsTypeNames(),
  ]);
  const excludedNote =
    excludedNames.length > 0 ? ` No incluye: ${excludedNames.join(", ")}.` : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos por tipo</CardTitle>
        <CardDescription>
          Distribución de egresos del período seleccionado.{excludedNote}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay gastos registrados en este período.
          </p>
        ) : (
          <ExpensesByTypeChart expenses={expenses} />
        )}
      </CardContent>
    </Card>
  );
}
