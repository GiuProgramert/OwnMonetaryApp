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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Pencil, TrashIcon } from "lucide-react";

interface Props {
  searchParams: MovementFilter;
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
                    <div className="flex items-center gap-2">
                      <div
                        style={{ backgroundColor: movement.accounts.color }}
                        className="w-3 h-3 rounded-full shrink-0"
                      />
                      <span>{movement.accounts.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          backgroundColor: movement.movement_types.color,
                        }}
                        className="w-3 h-3 rounded-full shrink-0"
                      />
                      <span>{movement.movement_types.name}</span>
                    </div>
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
                      <Link
                        className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
                        href={`/protected/movements/edit/${movement.id}`}
                      >
                        <Pencil className="h-6 w-6" />
                      </Link>
                      <Link
                        className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
                        href={`/protected/movements/delete/${movement.id}`}
                      >
                        <TrashIcon className="h-6 w-6" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-2">
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
