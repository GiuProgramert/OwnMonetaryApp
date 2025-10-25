import { Pencil, TrashIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { getMovementTypes } from "@/lib/services/movement-types";

export default async function MovementTypesTable() {
  const movementTypes = await getMovementTypes();

  return (
    <div className="space-y-2">
      {movementTypes.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay tipos aún.</p>
      )}

      {movementTypes.length > 0 && (
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
                <TableCell>{movementType.description}</TableCell>
                <TableCell>
                  <div
                    style={{ backgroundColor: movementType.color }}
                    className="w-8 h-8 rounded-full"
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
                    <Link
                      className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
                      href={`/protected/movement-types/edit/${movementType.id}`}
                    >
                      <Pencil className="h-6 w-6" />
                    </Link>
                    <Link
                      className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
                      href={`/protected/movement-types/delete/${movementType.id}`}
                    >
                      <TrashIcon className="h-6 w-6" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
