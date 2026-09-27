import { Pencil, TrashIcon } from "lucide-react";
import Link from "next/link";
import RecordCard from "@/components/record-card";
import { ColoredLabel } from "@/components/movements/table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMovementDate } from "@/lib/movements/datetime";
import { Movement } from "@/lib/schemas/movements";

interface Props {
  movements: Movement[];
}

function PaymentActions({ id }: { id: string }) {
  return (
    <>
      <Link
        aria-label="Editar pago"
        className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/movements/edit/${id}`}
      >
        <Pencil className="h-6 w-6" />
      </Link>
      <Link
        aria-label="Eliminar pago"
        className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/movements/delete/${id}`}
      >
        <TrashIcon className="h-6 w-6" />
      </Link>
    </>
  );
}

export default function DebtMovementsTable({ movements }: Props) {
  if (movements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay pagos registrados.
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>{formatMovementDate(movement.date)}</TableCell>
                <TableCell className="max-w-56 truncate">
                  {movement.description}
                </TableCell>
                <TableCell>
                  Gs. {movement.amount.toLocaleString("es-PY")}
                </TableCell>
                <TableCell>
                  <ColoredLabel
                    color={movement.accounts.color}
                    name={movement.accounts.name}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <PaymentActions id={movement.id} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {movements.map((movement) => (
          <li key={movement.id} className="min-w-0">
            <RecordCard
              title={<span className="block break-words">{movement.description}</span>}
              actions={<PaymentActions id={movement.id} />}
              fields={[
                { label: "Fecha", value: formatMovementDate(movement.date) },
                {
                  label: "Monto",
                  value: `Gs. ${movement.amount.toLocaleString("es-PY")}`,
                },
                {
                  label: "Cuenta",
                  value: (
                    <ColoredLabel
                      className="justify-end"
                      color={movement.accounts.color}
                      name={movement.accounts.name}
                    />
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
