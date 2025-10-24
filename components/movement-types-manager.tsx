import { MovementType } from "@/lib/types";
import { Pencil, TrashIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function MovementTypesManager() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("movement_types")
    .select("id,name,description,created_at,updated_at")
    .order("created_at", { ascending: false });

  const items: MovementType[] = (data ?? []) as MovementType[];

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay tipos aún.</p>
      )}

      {items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Actualizado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>
                  {new Date(item.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {new Date(item.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Link
                      className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
                      href={`/protected/movement-types/edit/${item.id}`}
                    >
                      <Pencil className="h-6 w-6" />
                    </Link>
                    <Link
                      className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
                      href={`/protected/movement-types/delete/${item.id}`}
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
