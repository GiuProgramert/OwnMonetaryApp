import { getAccounts } from "@/lib/services/accounts";
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
import Link from "next/link";
import { Pencil, TrashIcon } from "lucide-react";

function AccountActions({ id }: { id: string }) {
  return (
    <>
      {/* TODO: link "ver movimientos" a /protected/movements?accountId=... */}
      <Link
        aria-label="Editar cuenta"
        className="flex justify-center items-center rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/accounts/edit/${id}`}
      >
        <Pencil className="h-6 w-6" />
      </Link>
      <Link
        aria-label="Eliminar cuenta"
        className="flex justify-center items-center rounded-md hover:bg-red-500 hover:text-white transition-colors duration-300 h-10 w-10"
        href={`/protected/accounts/delete/${id}`}
      >
        <TrashIcon className="h-6 w-6" />
      </Link>
    </>
  );
}

export default async function AccountsTable() {
  const accounts = await getAccounts();

  return (
    <div className="space-y-2">
      {accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay cuentas aún.</p>
      )}

      {accounts.length > 0 && (
        <>
          <div className="hidden md:block">
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
                    <TableCell className="max-w-56">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{account.name}</span>
                        {account.is_primary && (
                          <Badge variant="secondary" className="shrink-0">
                            Principal
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      Gs. {account.current_balance.toLocaleString("es-PY")}
                    </TableCell>
                    <TableCell>
                      <div
                        style={{ backgroundColor: account.color }}
                        className="w-8 h-8 rounded-full shrink-0"
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
                        <AccountActions id={account.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {accounts.map((account) => (
              <li key={account.id} className="min-w-0">
                <RecordCard
                  title={
                    <div className="flex items-center gap-2">
                      <div
                        style={{ backgroundColor: account.color }}
                        className="w-3 h-3 rounded-full shrink-0"
                      />
                      <span className="min-w-0 break-words">{account.name}</span>
                      {account.is_primary && (
                        <Badge variant="secondary" className="shrink-0">
                          Principal
                        </Badge>
                      )}
                    </div>
                  }
                  actions={<AccountActions id={account.id} />}
                  fields={[
                    {
                      label: "Saldo actual",
                      value: `Gs. ${account.current_balance.toLocaleString("es-PY")}`,
                    },
                    {
                      label: "Creado",
                      value: new Date(account.created_at).toLocaleDateString(),
                    },
                    {
                      label: "Actualizado",
                      value: new Date(account.updated_at).toLocaleDateString(),
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
