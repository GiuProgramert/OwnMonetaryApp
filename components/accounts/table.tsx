import { getAccounts } from "@/lib/services/accounts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Pencil, TrashIcon } from "lucide-react";

export default async function AccountsTable() {
  const accounts = await getAccounts();

  return (
    <div className="space-y-2">
      {accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay cuentas aún.</p>
      )}

      {accounts.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Saldo actual</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Actualizado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="max-w-56 truncate">
                  {account.name}
                </TableCell>
                <TableCell>
                  Gs. {account.current_balance.toLocaleString("es-PY")}
                </TableCell>
                <TableCell>
                  <div
                    style={{ backgroundColor: account.color }}
                    className="w-8 h-8 rounded-full"
                  ></div>
                </TableCell>
                <TableCell>
                  {new Date(account.created_at).toLocaleDateString()}
                </TableCell>

                <TableCell>
                  {new Date(account.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Link
                      className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
                      href={`/protected/accounts/edit/${account.id}`}
                    >
                      <Pencil className="h-6 w-6" />
                    </Link>
                    <Link
                      className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
                      href={`/protected/accounts/delete/${account.id}`}
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
