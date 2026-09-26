import MovementTypesTable from "@/components/movement-types/table";
import TableSkeleton from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default async function Page() {
  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Tipos de movimiento</h1>
        <Button asChild>
          <Link href="/protected/movement-types/create">
            <Plus />
            <span>Nuevo</span>
          </Link>
        </Button>
      </div>
      <div className="space-y-6">
        <div className="p-3 sm:p-4 border rounded-md bg-card">
          <Suspense fallback={<TableSkeleton columns={5} />}>
            <MovementTypesTable />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
