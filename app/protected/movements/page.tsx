import MovementsTable from "@/components/movements/table";
import MovementsFilters from "@/components/movements/filters";
import MovementsTotals from "@/components/movements/totals";
import TableSkeleton from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { MovementFilter } from "@/lib/schemas/movements";
import { resolveAccountFilter } from "@/lib/accounts/primary";
import { getAccounts } from "@/lib/services/accounts";
import { getMovementTypes } from "@/lib/services/movement-types";
import { ArrowLeftRight, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    accountId?: string;
    movementTypeId?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}) {
  const rawParams = await searchParams;

  const [accounts, movementTypes] = await Promise.all([
    getAccounts(),
    getMovementTypes(),
  ]);

  const accountFilter = resolveAccountFilter(rawParams, accounts);

  const params: MovementFilter = {
    accountId: accountFilter.accountId,
    movementTypeId: rawParams.movementTypeId,
    startDate: rawParams.startDate,
    endDate: rawParams.endDate,
    page: rawParams.page ? Number(rawParams.page) : undefined,
  };

  // Filtros que eligió el usuario, no el default de cuenta principal.
  const hasExplicitFilters = Boolean(
    rawParams.accountId ||
      rawParams.movementTypeId ||
      rawParams.startDate ||
      rawParams.endDate
  );

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Movimientos</h1>
        <Button asChild>
          <Link
            href={`/protected/movements/create?accountId=${accountFilter.param}`}
          >
            <Plus />
            <span>Nuevo</span>
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/protected/movements/import">
            <Upload />
            <span>Importar</span>
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/protected/transfers/create">
            <ArrowLeftRight />
            <span>Transferir</span>
          </Link>
        </Button>
      </div>
      <div className="space-y-6">
        <MovementsFilters
          accounts={accounts}
          movementTypes={movementTypes}
          accountId={accountFilter.param}
        />
        <Suspense fallback={null}>
          <MovementsTotals filter={params} />
        </Suspense>
        <div className="p-3 sm:p-4 border rounded-md bg-card">
          <Suspense fallback={<TableSkeleton columns={6} />}>
            <MovementsTable
              searchParams={params}
              accountFilter={accountFilter}
              hasExplicitFilters={hasExplicitFilters}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
