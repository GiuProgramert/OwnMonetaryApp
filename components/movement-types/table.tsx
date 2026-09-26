import { Pencil, TrashIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RecordCard from "@/components/record-card";
import Link from "next/link";
import { getMovementTypes } from "@/lib/services/movement-types";

function MovementTypeActions({ id }: { id: string }) {
  return (
    <>
      <Link
        aria-label="Editar tipo de movimiento"
        className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/movement-types/edit/${id}`}
      >
        <Pencil className="h-6 w-6" />
      </Link>
      <Link
        aria-label="Eliminar tipo de movimiento"
        className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/movement-types/delete/${id}`}
      >
        <TrashIcon className="h-6 w-6" />
      </Link>
    </>
  );
}

export default async function MovementTypesTable() {
  const movementTypes = await getMovementTypes();

  return (
    <div className="space-y-2">
      {movementTypes.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay tipos aún.</p>
      )}

      {movementTypes.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementTypes.map((movementType) => (
                  <TableRow key={movementType.id}>
                    <TableCell className="max-w-56 truncate">
                      {movementType.name}
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {movementType.description}
                    </TableCell>
                    <TableCell>
                      <div
                        style={{ backgroundColor: movementType.color }}
                        className="w-8 h-8 rounded-full shrink-0"
                      ></div>
                    </TableCell>
                    <TableCell>
                      {new Date(movementType.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(movementType.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <MovementTypeActions id={movementType.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {movementTypes.map((movementType) => (
              <li key={movementType.id} className="min-w-0">
                <RecordCard
                  title={
                    <div className="flex items-center gap-2">
                      <div
                        style={{ backgroundColor: movementType.color }}
                        className="w-3 h-3 rounded-full shrink-0"
                      />
                      <span className="min-w-0 break-words">{movementType.name}</span>
                    </div>
                  }
                  actions={<MovementTypeActions id={movementType.id} />}
                  fields={[
                    {
                      label: "Descripción",
                      value: movementType.description,
                    },
                    {
                      label: "Creado",
                      value: new Date(
                        movementType.created_at
                      ).toLocaleDateString(),
                    },
                    {
                      label: "Actualizado",
                      value: new Date(
                        movementType.updated_at
                      ).toLocaleDateString(),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
