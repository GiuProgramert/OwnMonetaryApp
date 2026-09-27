import { Pencil, TrashIcon, Eye, CircleDollarSign } from "lucide-react";
import Link from "next/link";
import RecordCard from "@/components/record-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dueLabel, dueTone, formatDueDate } from "@/lib/debts/due";
import { formatCurrency } from "@/lib/dashboard/format";
import { debtKindOptions, DebtStatus } from "@/lib/schemas/debts";
import { withReturnTo } from "@/lib/return-to";
import { getDebts } from "@/lib/services/debts";
import { cn } from "@/lib/utils";

function kindLabel(kind: DebtStatus["kind"]) {
  return debtKindOptions.find((option) => option.value === kind)?.label ?? kind;
}

function DueDate({ debt }: { debt: DebtStatus }) {
  if (!debt.next_due_date) {
    return <span className="text-muted-foreground">—</span>;
  }

  const tone = dueTone(debt.next_due_date);

  return (
    <div className="flex flex-col">
      <span>{formatDueDate(debt.next_due_date)}</span>
      <span className={cn("text-xs", tone === "overdue" && "font-medium text-red-500")}>
        {dueLabel(debt.next_due_date)}
      </span>
    </div>
  );
}

function DebtActions({ debt }: { debt: DebtStatus }) {
  return (
    <>
      <Link
        aria-label="Ver deuda"
        className="flex justify-center items-center rounded-md hover:bg-green-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/debts/${debt.id}`}
      >
        <Eye className="h-6 w-6" />
      </Link>
      {!debt.finished && (
        <Link
          aria-label="Pagar deuda"
          className="flex justify-center items-center rounded-md hover:bg-emerald-500 hover:text-white transition-colors duration-300 h-10 w-10"
          href={withReturnTo(`/protected/debts/${debt.id}/pay`, "/protected/debts")}
        >
          <CircleDollarSign className="h-6 w-6" />
        </Link>
      )}
      <Link
        aria-label="Editar deuda"
        className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={withReturnTo(`/protected/debts/edit/${debt.id}`, "/protected/debts")}
      >
        <Pencil className="h-6 w-6" />
      </Link>
      <Link
        aria-label="Eliminar deuda"
        className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/debts/delete/${debt.id}`}
      >
        <TrashIcon className="h-6 w-6" />
      </Link>
    </>
  );
}

export default async function DebtsTable() {
  const debts = await getDebts();

  if (debts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay deudas cargadas aún.{" "}
        <Link href="/protected/debts/create" className="underline">
          Crear una
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Cuotas</TableHead>
              <TableHead>Pagado</TableHead>
              <TableHead>Por pagar</TableHead>
              <TableHead>Próximo vencimiento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debts.map((debt) => (
              <TableRow key={debt.id} className={cn(debt.finished && "opacity-60")}>
                <TableCell className="max-w-56 truncate">{debt.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{kindLabel(debt.kind)}</Badge>
                </TableCell>
                <TableCell>
                  {debt.amount_mode === "variable" ? "≈ " : ""}
                  {formatCurrency(debt.amount)}
                </TableCell>
                <TableCell>
                  {debt.kind === "installments"
                    ? `${debt.paid_installments}/${debt.total_installments}`
                    : "—"}
                </TableCell>
                <TableCell>{formatCurrency(debt.paid_amount)}</TableCell>
                <TableCell>
                  {debt.remaining_amount !== null ? (
                    <>
                      {debt.amount_mode === "variable" ? "≈ " : ""}
                      {formatCurrency(debt.remaining_amount)}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <DueDate debt={debt} />
                </TableCell>
                <TableCell>
                  {debt.finished ? (
                    <Badge variant="secondary">Finalizada</Badge>
                  ) : (
                    <Badge variant="outline">Activa</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <DebtActions debt={debt} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {debts.map((debt) => (
          <li key={debt.id} className="min-w-0">
            <RecordCard
              className={cn(debt.finished && "opacity-60")}
              title={<span className="break-words">{debt.name}</span>}
              actions={<DebtActions debt={debt} />}
              fields={[
                { label: "Tipo", value: kindLabel(debt.kind) },
                {
                  label: "Monto",
                  value: `${debt.amount_mode === "variable" ? "≈ " : ""}${formatCurrency(debt.amount)}`,
                },
                ...(debt.kind === "installments"
                  ? [
                      {
                        label: "Cuotas",
                        value: `${debt.paid_installments}/${debt.total_installments}`,
                      },
                    ]
                  : []),
                { label: "Pagado", value: formatCurrency(debt.paid_amount) },
                ...(debt.remaining_amount !== null
                  ? [
                      {
                        label: "Por pagar",
                        value: `${debt.amount_mode === "variable" ? "≈ " : ""}${formatCurrency(debt.remaining_amount)}`,
                      },
                    ]
                  : []),
                {
                  label: "Próximo vencimiento",
                  value: <DueDate debt={debt} />,
                },
                {
                  label: "Estado",
                  value: debt.finished ? (
                    <Badge variant="secondary">Finalizada</Badge>
                  ) : (
                    <Badge variant="outline">Activa</Badge>
                  ),
                },
              ]}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
