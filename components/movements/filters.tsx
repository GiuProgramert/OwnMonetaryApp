"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Account } from "@/lib/schemas/accounts";
import { MovementType } from "@/lib/schemas/movement-types";
import AccountSelect from "@/components/account-select";
import MovementTypeSelect from "@/components/movement-type-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  accounts: Pick<Account, "id" | "name" | "color">[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function MovementsFilters({ accounts, movementTypes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
      <div className="grid gap-2">
        <Label>Cuenta</Label>
        <AccountSelect
          accounts={accounts}
          value={searchParams.get("accountId") ?? "all"}
          onChange={(value) =>
            setParam("accountId", value === "all" ? undefined : value)
          }
          allLabel="Todas las cuentas"
        />
      </div>
      <div className="grid gap-2">
        <Label>Tipo de movimiento</Label>
        <MovementTypeSelect
          movementTypes={movementTypes}
          value={searchParams.get("movementTypeId") ?? "all"}
          onChange={(value) =>
            setParam("movementTypeId", value === "all" ? undefined : value)
          }
          allLabel="Todos los tipos"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="startDate">Desde</Label>
        <Input
          id="startDate"
          type="date"
          defaultValue={searchParams.get("startDate") ?? ""}
          onChange={(e) => setParam("startDate", e.target.value || undefined)}
          className="bg-gray-600 border rounded-md p-2"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="endDate">Hasta</Label>
        <Input
          id="endDate"
          type="date"
          defaultValue={searchParams.get("endDate") ?? ""}
          onChange={(e) => setParam("endDate", e.target.value || undefined)}
          className="bg-gray-600 border rounded-md p-2"
        />
      </div>
      <div>
        <Button type="button" variant="outline" onClick={() => router.push(pathname)}>
          Limpiar filtros
        </Button>
        {/* TODO: exportar la vista filtrada a CSV */}
      </div>
    </div>
  );
}
