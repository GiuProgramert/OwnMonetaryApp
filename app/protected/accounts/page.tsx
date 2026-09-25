import AccountsTable from "@/components/accounts/table";
import TableSkeleton from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default async function AccountsPage() {
  return (
    <div className="w-full">
      <div className="mb-4 flex gap-4 items-center">
        <h1 className="text-2xl font-semibold">Cuentas</h1>
        <Button asChild>
          <Link href="/protected/accounts/create">
            <Plus />
            <span>Nuevo</span>
          </Link>
        </Button>
      </div>
      <div className="space-y-6">
        <div className="p-4 border rounded-md bg-card">
          <Suspense fallback={<TableSkeleton />}>
            <AccountsTable />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
