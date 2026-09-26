import { History, Pencil, TrashIcon } from "lucide-react";
import Link from "next/link";
import BudgetProgress from "@/components/budgets/budget-progress";
import RecordCard from "@/components/record-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/dashboard/format";
import { getBudgetStatus } from "@/lib/services/budgets";
import { cn } from "@/lib/utils";

interface Props {
  month: string;
}

function BudgetActions({ id }: { id: string }) {
  return (
    <>
      <Link
        aria-label="Ver histórico del presupuesto"
        className="flex justify-center items-center rounded-md hover:bg-green-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/budgets/${id}`}
      >
        <History className="h-6 w-6" />
      </Link>
      <Link
        aria-label="Editar presupuesto"
        className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/budgets/edit/${id}`}
      >
        <Pencil className="h-6 w-6" />
      </Link>
      <Link
        aria-label="Eliminar presupuesto"
        className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/budgets/delete/${id}`}
      >
        <TrashIcon className="h-6 w-6" />
      </Link>
    </>
  );
}

export default async function BudgetsTable({ month }: Props) {
  const statuses = await getBudgetStatus(month);

  // Los pausados van al final, apagados.
  const sorted = [...statuses].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active)
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay presupuestos configurados aún.
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Tope</TableHead>
              <TableHead>Gastado</TableHead>
              <TableHead>Restante</TableHead>
              <TableHead>Progreso</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((status) => (
              <TableRow
                key={status.budget_id}
                className={cn(!status.is_active && "opacity-60")}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      style={{ backgroundColor: status.color }}
                      className="w-3 h-3 rounded-full shrink-0"
                    />
                    <span className="max-w-56 truncate">{status.name}</span>
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(status.amount_limit)}</TableCell>
                <TableCell>{formatCurrency(status.spent)}</TableCell>
                <TableCell
                  className={cn(
                    status.remaining < 0 && "font-medium text-red-500"
                  )}
                >
                  {formatCurrency(status.remaining)}
                </TableCell>
                <TableCell>
                  <BudgetProgress status={status} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <BudgetActions id={status.budget_id} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {sorted.map((status) => (
          <li key={status.budget_id} className="min-w-0">
            <RecordCard
              className={cn(!status.is_active && "opacity-60")}
              title={
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    style={{ backgroundColor: status.color }}
                    className="w-3 h-3 rounded-full shrink-0"
                  />
                  <span className="min-w-0 break-words">{status.name}</span>
                </div>
              }
              actions={<BudgetActions id={status.budget_id} />}
              fields={[
                { label: "Tope", value: formatCurrency(status.amount_limit) },
                { label: "Gastado", value: formatCurrency(status.spent) },
                {
                  label: "Restante",
                  value: (
                    <span
                      className={cn(
                        status.remaining < 0 && "font-medium text-red-500"
                      )}
                    >
                      {formatCurrency(status.remaining)}
                    </span>
                  ),
                },
                { label: "", value: <BudgetProgress status={status} /> },
              ]}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
