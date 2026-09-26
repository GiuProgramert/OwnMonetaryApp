import MovementsTable from "@/components/movements/table";
import MovementsFilters from "@/components/movements/filters";
import MovementsTotals from "@/components/movements/totals";
import TableSkeleton from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { MovementFilter } from "@/lib/schemas/movements";
import { getAccounts } from "@/lib/services/accounts";
import { getMovementTypes } from "@/lib/services/movement-types";
import { Plus, Upload } from "lucide-react";
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
  const params: MovementFilter = {
    accountId: rawParams.accountId,
    movementTypeId: rawParams.movementTypeId,
    startDate: rawParams.startDate,
    endDate: rawParams.endDate,
    page: rawParams.page ? Number(rawParams.page) : undefined,
  };

  const [accounts, movementTypes] = await Promise.all([
    getAccounts(),
    getMovementTypes(),
  ]);

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Movimientos</h1>
        <Button asChild>
          <Link href="/protected/movements/create">
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
      </div>
      <div className="space-y-6">
        <MovementsFilters accounts={accounts} movementTypes={movementTypes} />
        <Suspense fallback={null}>
          <MovementsTotals filter={params} />
        </Suspense>
        <div className="p-3 sm:p-4 border rounded-md bg-card">
          <Suspense fallback={<TableSkeleton columns={6} />}>
            <MovementsTable searchParams={params} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
