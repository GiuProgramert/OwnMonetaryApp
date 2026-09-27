import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import DebtsTable from "@/components/debts/table";
import TableSkeleton from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";

export default function DebtsPage() {
  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Deudas</h1>
        <Button asChild>
          <Link href="/protected/debts/create">
            <Plus />
            <span>Nueva</span>
          </Link>
        </Button>
      </div>
      <div className="p-3 sm:p-4 border rounded-md bg-card">
        <Suspense fallback={<TableSkeleton columns={8} />}>
          <DebtsTable />
        </Suspense>
      </div>
    </div>
  );
}
