"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Account } from "@/lib/schemas/accounts";
import AccountSelect from "@/components/account-select";
import DateRangeFilter from "@/components/date-range-filter";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  accounts: Pick<Account, "id" | "name" | "color">[];
  /** Resuelto en el server (un uuid o `"all"`), igual que el rango de fechas. */
  accountId: string;
  startDate: string;
  endDate: string;
}

export default function DashboardFilters({
  accounts,
  accountId,
  startDate,
  endDate,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="grid gap-2 w-full sm:w-56">
        <Label>Cuenta</Label>
        <AccountSelect
          accounts={accounts}
          value={accountId}
          onChange={(value) => setParams({ accountId: value })}
          allLabel="Todas las cuentas"
        />
      </div>
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onChange={(range) => setParams(range)}
      />
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setParams({ startDate: undefined, endDate: undefined })}
        >
          Volver al mes actual
        </Button>
      </div>
    </div>
  );
}
