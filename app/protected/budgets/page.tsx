import BudgetsMonthFilter from "@/components/budgets/month-filter";
import BudgetsTable from "@/components/budgets/table";
import BudgetsTotals from "@/components/budgets/totals";
import TableSkeleton from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { resolveMonth } from "@/lib/budgets/month";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const rawParams = await searchParams;
  const month = resolveMonth({ month: rawParams.month });

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Presupuestos</h1>
        <Button asChild>
          <Link href="/protected/budgets/create">
            <Plus />
            <span>Nuevo</span>
          </Link>
        </Button>
      </div>
      <div className="space-y-6">
        <BudgetsMonthFilter month={month} />
        <Suspense fallback={null}>
          <BudgetsTotals month={month} />
        </Suspense>
        <div className="p-3 sm:p-4 border rounded-md bg-card">
          <Suspense fallback={<TableSkeleton columns={5} />}>
            <BudgetsTable month={month} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
