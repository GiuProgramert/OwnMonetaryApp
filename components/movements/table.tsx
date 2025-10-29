import { MovementFilter } from "@/lib/schemas/movements";
import getMovements from "@/lib/services/movements";
import { Table, TableBody, TableHeader, TableRow } from "../ui/table";

interface Props {
  searchParams: MovementFilter;
}

export default async function MovementsTable(props: Props) {
  const movements = await getMovements(props.searchParams);

  return (
    <div className="space-y-2">
      {movements.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay movimientos aún.</p>
      )}

      {movements.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Monto</th>
              <th>Tipo</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <td>{movement.date}</td>
                <td>{movement.description}</td>
                <td>{movement.amount}</td>
                <td>{movement.type}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
