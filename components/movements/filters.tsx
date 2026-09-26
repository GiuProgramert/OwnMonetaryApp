"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { allAccountsParam } from "@/lib/accounts/primary";
import { Account } from "@/lib/schemas/accounts";
import { MovementType } from "@/lib/schemas/movement-types";
import AccountSelect from "@/components/account-select";
import MovementTypeSelect from "@/components/movement-type-select";
import DateRangeFilter from "@/components/date-range-filter";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  accounts: Pick<Account, "id" | "name" | "color">[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
  /**
   * Resuelto en el server (un uuid o `"all"`), igual que `startDate`/`endDate`
   * en `components/dashboard/filters.tsx`: si se leyera de la URL, con
   * `?accountId` ausente el select mostraría "todas" mientras la tabla de abajo
   * muestra solo la cuenta principal.
   */
  accountId: string;
}

export default function MovementsFilters({
  accounts,
  movementTypes,
  accountId,
}: Props) {
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

  const setParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    // Limpiar = todas las cuentas, no la principal: sin `accountId` en la URL
    // el server volvería a aplicar el default, así que el "all" va explícito.
    const params = new URLSearchParams();
    params.set("accountId", allAccountsParam);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="grid gap-2 w-full sm:w-56">
        <Label>Cuenta</Label>
        <AccountSelect
          accounts={accounts}
          value={accountId}
          onChange={(value) => setParam("accountId", value)}
          allLabel="Todas las cuentas"
        />
      </div>
      <div className="grid gap-2 w-full sm:w-56">
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
      <DateRangeFilter
        startDate={searchParams.get("startDate") ?? undefined}
        endDate={searchParams.get("endDate") ?? undefined}
        onChange={(range) => setParams(range)}
      />
      <div>
        <Button type="button" variant="outline" onClick={clearFilters}>
          Limpiar filtros
        </Button>
        {/* TODO: exportar la vista filtrada a CSV */}
      </div>
    </div>
  );
}
