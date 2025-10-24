import MovementTypesManager from "@/components/movement-types-manager";
import TableSkeleton from "@/components/table-skeleton";
import { Suspense } from "react";

export default async function Page() {
  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold mb-4">Tipos de movimientos</h1>
      <div className="space-y-6">
        <div className="p-4 border rounded-md bg-card">
          <Suspense fallback={<TableSkeleton />}>
            <MovementTypesManager />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
