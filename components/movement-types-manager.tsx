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
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";

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
                    <Button className="hover:bg-blue-400 hover:text-white transition-colors duration-300 h-10 w-10">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button className="hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10">
                      <TrashIcon className="" />
                    </Button>
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
