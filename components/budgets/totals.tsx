import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/dashboard/format";
import { getBudgetStatus } from "@/lib/services/budgets";

interface Props {
  month: string;
}

export default async function BudgetsTotals({ month }: Props) {
  const statuses = (await getBudgetStatus(month)).filter(
    (status) => status.is_active
  );

  // Acá sí se suma en JS, y es correcto: las filas ya vienen agregadas por
  // `get_budget_status` (una por presupuesto, decenas como máximo), no son filas crudas de
  // `movements`. El corte de 1000 filas de PostgREST no aplica; no contradice la regla de CLAUDE.md.
  const budgeted = statuses.reduce((sum, s) => sum + s.amount_limit, 0);
  const spent = statuses.reduce((sum, s) => sum + s.spent, 0);
  const remaining = budgeted - spent;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Total presupuestado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xl font-semibold">
          {formatCurrency(budgeted)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Total gastado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xl font-semibold text-red-500">
          {formatCurrency(spent)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Restante del mes
          </CardTitle>
        </CardHeader>
        <CardContent
          className={`text-xl font-semibold ${
            remaining >= 0 ? "text-green-500" : "text-red-500"
          }`}
        >
          {formatCurrency(remaining)}
        </CardContent>
      </Card>
    </div>
  );
}
