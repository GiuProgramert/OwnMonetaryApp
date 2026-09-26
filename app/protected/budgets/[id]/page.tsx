import BudgetHistoryChart from "@/components/budgets/history-chart";
import FormContainer from "@/components/form-container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/dashboard/format";
import { getBudgetById, getBudgetHistory } from "@/lib/services/budgets";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function BudgetHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const budget = await getBudgetById(id);

  if (!budget) {
    notFound();
  }

  const history = await getBudgetHistory(id, 12);

  return (
    <FormContainer
      title={`Histórico: ${budget.movement_types.name}`}
      href="/protected/budgets"
      wide
    >
      <div className="space-y-6">
        {history.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay histórico suficiente para graficar: los meses se
            registran a medida que pasan.
          </p>
        ) : (
          <BudgetHistoryChart rows={history} />
        )}
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este presupuesto todavía no tiene meses registrados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead>Tope</TableHead>
                <TableHead>Gastado</TableHead>
                <TableHead>Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((row) => (
                <TableRow key={row.period_month}>
                  <TableCell>{row.monthLabel}</TableCell>
                  <TableCell>{formatCurrency(row.amount_limit)}</TableCell>
                  <TableCell>{formatCurrency(row.spent)}</TableCell>
                  <TableCell
                    className={cn(
                      "font-medium",
                      row.remaining >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {formatCurrency(row.remaining)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </FormContainer>
  );
}
