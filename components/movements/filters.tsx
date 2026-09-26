"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="grid gap-2 w-full sm:w-56">
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
        <Button type="button" variant="outline" onClick={() => router.push(pathname)}>
          Limpiar filtros
        </Button>
        {/* TODO: exportar la vista filtrada a CSV */}
      </div>
    </div>
  );
}
