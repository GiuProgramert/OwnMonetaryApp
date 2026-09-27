import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/dashboard/format";
import { dueLabel, dueTone } from "@/lib/debts/due";
import { withReturnTo } from "@/lib/return-to";
import { getUpcomingDebts } from "@/lib/services/debts";

export default async function UpcomingDebtsCard() {
  // Recordatorio: no sigue los filtros de cuenta ni de fecha del dashboard, igual que BudgetsCard.
  const debts = await getUpcomingDebts(7);

  const sorted = [...debts].sort((a, b) =>
    (a.next_due_date ?? "").localeCompare(b.next_due_date ?? "")
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle>Vencimientos</CardTitle>
        <Link
          href="/protected/debts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver todas
        </Link>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay vencimientos en los próximos 7 días.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sorted.map((debt) => (
              <li
                key={debt.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{debt.name}</p>
                  <p
                    className={
                      dueTone(debt.next_due_date as string) === "overdue"
                        ? "text-sm font-medium text-red-500"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {debt.amount_mode === "variable" ? "≈ " : ""}
                    {formatCurrency(debt.amount)} · {dueLabel(debt.next_due_date as string)}
                  </p>
                </div>
                <Link
                  href={withReturnTo(`/protected/debts/${debt.id}/pay`, "/protected")}
                  className="text-sm underline shrink-0"
                >
                  Pagar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
