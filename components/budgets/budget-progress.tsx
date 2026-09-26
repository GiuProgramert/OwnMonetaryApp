import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/dashboard/format";
import { BudgetStatus } from "@/lib/schemas/budgets";
import { cn } from "@/lib/utils";

const WARNING_THRESHOLD = 80;
const WARNING_COLOR = "#f59e0b";
const EXCEEDED_COLOR = "#ef4444";

interface Props {
  status: BudgetStatus;
}

export default function BudgetProgress({ status }: Props) {
  if (!status.is_active) {
    return <Badge variant="secondary">Pausado</Badge>;
  }

  const exceeded = status.spent > status.amount_limit;
  // `percentage` ya viene defendido contra amount_limit en 0 desde el servicio.
  const percentage = status.percentage;

  // `Progress` clampea: el exceso se comunica con el color y el número, no con el largo.
  const barValue = exceeded ? 100 : Math.min(percentage, 100);
  const barColor = exceeded
    ? EXCEEDED_COLOR
    : percentage >= WARNING_THRESHOLD
      ? WARNING_COLOR
      : status.color;

  return (
    <div className="grid gap-1 min-w-48">
      <Progress
        value={barValue}
        style={{ "--bar-color": barColor } as React.CSSProperties}
        className="[&>div]:bg-[var(--bar-color)]"
      />
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {formatCurrency(status.spent)} / {formatCurrency(status.amount_limit)}
        </span>
        <span className={cn(exceeded && "font-medium text-red-500")}>
          {exceeded
            ? `Excedido ${formatCurrency(Math.abs(status.remaining))}`
            : `Restan ${formatCurrency(status.remaining)}`}
        </span>
      </div>
    </div>
  );
}
