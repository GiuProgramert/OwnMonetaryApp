import MovementsTable from "@/components/movements/table";
import MovementsFilters from "@/components/movements/filters";
import MovementsTotals from "@/components/movements/totals";
import TableSkeleton from "@/components/table-skeleton";
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
      <div className="mb-4 flex gap-4 items-center">
        <h1 className="text-2xl font-semibold">Movimientos</h1>
        <Link
          href="/protected/movements/create"
          className="flex gap-1 pr-5 pl-4 py-2 rounded-md bg-[#fafafa] hover:bg-[#b3b3b3] text-black transition-all duration-400 ease-in-out border"
        >
          <Plus />
          <span>Nuevo</span>
        </Link>
        <Link
          href="/protected/movements/import"
          className="flex gap-1 pr-5 pl-4 py-2 rounded-md bg-gray-600 hover:bg-gray-700 transition-all duration-400 ease-in-out border"
        >
          <Upload />
          <span>Importar</span>
        </Link>
      </div>
      <div className="space-y-6">
        <MovementsFilters accounts={accounts} movementTypes={movementTypes} />
        <Suspense fallback={null}>
          <MovementsTotals filter={params} />
        </Suspense>
        <div className="p-4 border rounded-md bg-card">
          <Suspense fallback={<TableSkeleton />}>
            <MovementsTable searchParams={params} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
