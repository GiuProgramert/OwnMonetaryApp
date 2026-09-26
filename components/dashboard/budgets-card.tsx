import Link from "next/link";

import BudgetProgress from "@/components/budgets/budget-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMonthLabel, resolveMonth } from "@/lib/budgets/month";
import { formatCurrency } from "@/lib/dashboard/format";
import { getBudgetStatus } from "@/lib/services/budgets";

export default async function BudgetsCard() {
  // Los presupuestos son siempre por mes calendario: no dependen de los filtros del dashboard.
  const month = resolveMonth({});
  const statuses = (await getBudgetStatus(month))
    .filter((status) => status.is_active)
    .sort((a, b) => b.percentage - a.percentage);

  // Filas ya agregadas por `get_budget_status` (una por presupuesto), sumar en JS es correcto.
  const budgeted = statuses.reduce((sum, s) => sum + s.amount_limit, 0);
  const spent = statuses.reduce((sum, s) => sum + s.spent, 0);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-1">
          <CardTitle>Presupuestos</CardTitle>
          <p className="text-sm text-muted-foreground">
            {getMonthLabel(month)}
            {statuses.length > 0 &&
              ` · ${formatCurrency(spent)} de ${formatCurrency(budgeted)}`}
          </p>
        </div>
        <Link
          href="/protected/budgets"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver todos
        </Link>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay presupuestos configurados aún.{" "}
            <Link
              href="/protected/budgets/create"
              className="underline hover:text-foreground"
            >
              Crear uno
            </Link>
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {statuses.map((status) => (
              <li key={status.budget_id} className="grid gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <div
                    style={{ backgroundColor: status.color }}
                    className="w-3 h-3 rounded-full shrink-0"
                  />
                  <span className="truncate">{status.name}</span>
                </div>
                <BudgetProgress status={status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
