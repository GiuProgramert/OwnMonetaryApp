import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/dashboard/format";
import { dueLabel, dueTone, formatDueDate } from "@/lib/debts/due";
import { DebtStatus } from "@/lib/schemas/debts";
import { cn } from "@/lib/utils";

interface Props {
  debt: DebtStatus;
}

function SummaryCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent className="text-lg font-medium">{children}</CardContent>
    </Card>
  );
}

export default function DebtSummary({ debt }: Props) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Pagado">{formatCurrency(debt.paid_amount)}</SummaryCard>

      {debt.kind === "installments" && (
        <>
          <SummaryCard label="Por pagar">
            {debt.amount_mode === "variable" ? "≈ " : ""}
            {formatCurrency(debt.remaining_amount ?? 0)}
          </SummaryCard>
          <SummaryCard label="Cuotas">
            {debt.paid_installments}/{debt.total_installments}
          </SummaryCard>
        </>
      )}

      <SummaryCard label="Próximo vencimiento">
        {debt.next_due_date ? (
          <div className="flex flex-col gap-1">
            <span>{formatDueDate(debt.next_due_date)}</span>
            <span
              className={cn(
                "text-sm font-normal",
                dueTone(debt.next_due_date) === "overdue" && "font-medium text-red-500"
              )}
            >
              {dueLabel(debt.next_due_date)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </SummaryCard>

      <SummaryCard label="Estado">
        {debt.finished ? (
          <Badge variant="secondary">Finalizada</Badge>
        ) : (
          <Badge variant="outline">Activa</Badge>
        )}
      </SummaryCard>
    </div>
  );
}
