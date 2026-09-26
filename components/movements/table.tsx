import { MovementFilter } from "@/lib/schemas/movements";
import getMovements, { MOVEMENTS_PAGE_SIZE } from "@/lib/services/movements";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RecordCard from "@/components/record-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Pencil, TrashIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  searchParams: MovementFilter;
}

function MovementActions({ id }: { id: string }) {
  return (
    <>
      <Link
        aria-label="Editar movimiento"
        className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/movements/edit/${id}`}
      >
        <Pencil className="h-6 w-6" />
      </Link>
      <Link
        aria-label="Eliminar movimiento"
        className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/movements/delete/${id}`}
      >
        <TrashIcon className="h-6 w-6" />
      </Link>
    </>
  );
}

function ColoredLabel({
  color,
  name,
  className,
}: {
  color: string;
  name: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <div
        style={{ backgroundColor: color }}
        className="w-3 h-3 rounded-full shrink-0"
      />
      <span className="min-w-0 truncate">{name}</span>
    </div>
  );
}

export default async function MovementsTable({ searchParams }: Props) {
  const { data: movements, count } = await getMovements(searchParams);

  const hasFilters = Boolean(
    searchParams.accountId ||
    searchParams.movementTypeId ||
    searchParams.startDate ||
    searchParams.endDate,
  );

  const currentPage = searchParams.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(count / MOVEMENTS_PAGE_SIZE));

  const pageHref = (page: number) => {
    const params = new URLSearchParams();

    if (searchParams.accountId) {
      params.set("accountId", searchParams.accountId);
    }

    if (searchParams.movementTypeId) {
      params.set("movementTypeId", searchParams.movementTypeId);
    }

    if (searchParams.startDate) {
      params.set("startDate", searchParams.startDate);
    }

    if (searchParams.endDate) {
      params.set("endDate", searchParams.endDate);
    }

    params.set("page", String(page));
    return `/protected/movements?${params.toString()}`;
  };

  return (
    <div className="space-y-2">
      {movements.length === 0 && !hasFilters && (
        <p className="text-sm text-muted-foreground">No hay movimientos aún.</p>
      )}

      {movements.length === 0 && hasFilters && (
        <p className="text-sm text-muted-foreground">
          No hay resultados para estos filtros.
        </p>
      )}

      {movements.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Naturaleza</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      {new Date(movement.date).toLocaleDateString("es-PY")}
                    </TableCell>
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
                      <ColoredLabel
                        color={movement.movement_types.color}
                        name={movement.movement_types.name}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          movement.type === "credit" ? "default" : "destructive"
                        }
                      >
                        {movement.type === "credit" ? "Crédito" : "Débito"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <MovementActions id={movement.id} />
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
                  title={
                    <span className="block break-words">
                      {movement.description}
                    </span>
                  }
                  actions={<MovementActions id={movement.id} />}
                  fields={[
                    {
                      label: "Fecha",
                      value: new Date(movement.date).toLocaleDateString(
                        "es-PY"
                      ),
                    },
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
                    {
                      label: "Tipo",
                      value: (
                        <ColoredLabel
                          className="justify-end"
                          color={movement.movement_types.color}
                          name={movement.movement_types.name}
                        />
                      ),
                    },
                    {
                      label: "Naturaleza",
                      value: (
                        <Badge
                          variant={
                            movement.type === "credit"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {movement.type === "credit" ? "Crédito" : "Débito"}
                        </Badge>
                      ),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link
                  href={pageHref(currentPage - 1)}
                  aria-disabled={currentPage <= 1}
                  tabIndex={currentPage <= 1 ? -1 : undefined}
                  className={
                    currentPage <= 1 ? "pointer-events-none opacity-50" : ""
                  }
                >
                  Anterior
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={pageHref(currentPage + 1)}
                  aria-disabled={currentPage >= totalPages}
                  tabIndex={currentPage >= totalPages ? -1 : undefined}
                  className={
                    currentPage >= totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                >
                  Siguiente
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
