"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Account } from "@/lib/schemas/accounts";
import AccountSelect from "@/components/account-select";
import DateRangeFilter from "@/components/date-range-filter";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  accounts: Pick<Account, "id" | "name" | "color">[];
  startDate: string;
  endDate: string;
}

export default function DashboardFilters({ accounts, startDate, endDate }: Props) {
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
          value={searchParams.get("accountId") ?? "all"}
          onChange={(value) =>
            setParams({ accountId: value === "all" ? undefined : value })
          }
          allLabel="Todas las cuentas"
        />
      </div>
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onChange={(range) => setParams(range)}
      />
      <div>
        <Button type="button" variant="outline" onClick={() => router.push(pathname)}>
          Volver al mes actual
        </Button>
      </div>
    </div>
  );
}
