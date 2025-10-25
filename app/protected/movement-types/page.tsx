import MovementTypesManager from "@/components/movement-types-manager";
import TableSkeleton from "@/components/table-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default async function Page() {
  return (
    <div className="w-full">
      <div className="mb-4 flex gap-4 items-center">
        <h1 className="text-2xl font-semibold">Tipos de movimientos</h1>
        <Link href="/protected/movement-types/create" className="flex gap-2 pr-2 pl-1 py-1 rounded-md bg-[#fafafa] hover:bg-[#e4e5e5] text-black">
          <Plus />
          <span>Nuevo</span>
        </Link>
      </div>
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
