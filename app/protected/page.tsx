import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/services/accounts";
import { resolveAccountFilter } from "@/lib/accounts/primary";
import { resolveDateRange, resolveDailyExpensesRange } from "@/lib/dashboard/date-range";
import { DashboardFilter, DailyExpensesFilter as DailyExpensesFilterType } from "@/lib/schemas/dashboard";

import DashboardFilters from "@/components/dashboard/filters";
import ChartSkeleton from "@/components/dashboard/chart-skeleton";
import BalanceDistributionCard from "@/components/dashboard/balance-distribution-card";
import BudgetsCard from "@/components/dashboard/budgets-card";
import UpcomingDebtsCard from "@/components/dashboard/upcoming-debts-card";
import ExpensesByTypeCard from "@/components/dashboard/expenses-by-type-card";
import MonthlyFlowCard from "@/components/dashboard/monthly-flow-card";
import DailyExpensesCard from "@/components/dashboard/daily-expenses-card";
import NetWorthCard from "@/components/dashboard/net-worth-card";
import RecentMovementsCard from "@/components/dashboard/recent-movements-card";
import TopExpensesCard from "@/components/dashboard/top-expenses-card";
import MovementsTotals from "@/components/movements/totals";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function ProtectedPage({
  searchParams,
}: {
  searchParams: Promise<{
    accountId?: string;
    startDate?: string;
    endDate?: string;
    dailyRange?: string;
    dailyStart?: string;
    dailyEnd?: string;
    dailyTypes?: string;
  }>;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const rawParams = await searchParams;
  const { startDate, endDate } = resolveDateRange(rawParams);

  const accounts = await getAccounts();
  const accountFilter = resolveAccountFilter(rawParams, accounts);

  const filter: DashboardFilter = {
    accountId: accountFilter.accountId,
    startDate,
    endDate,
  };

  const dailyRange = resolveDailyExpensesRange(rawParams);
  const dailyExpensesFilter: DailyExpensesFilterType = {
    accountId: accountFilter.accountId,
    startDate: dailyRange.startDate,
    endDate: dailyRange.endDate,
    showAllTypes: rawParams.dailyTypes === "all",
  };

  const movementFilter = {
    accountId: filter.accountId,
    movementTypeId: undefined,
    startDate: filter.startDate,
    endDate: filter.endDate,
    page: undefined,
  };

  const movementsHref = (() => {
    const params = new URLSearchParams();
    // Siempre explícito: sin `accountId`, movimientos volvería a aplicar su
    // propio default (la cuenta principal) en vez de conservar lo que se ve acá.
    params.set("accountId", accountFilter.param);
    params.set("startDate", startDate);
    params.set("endDate", endDate);
    return `/protected/movements?${params.toString()}`;
  })();

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <DashboardFilters
        accounts={accounts}
        accountId={accountFilter.param}
        startDate={startDate}
        endDate={endDate}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<CardSkeleton />}>
          <NetWorthCard />
        </Suspense>
        <div className="sm:col-span-2 lg:col-span-3">
          <Suspense fallback={null}>
            <MovementsTotals filter={movementFilter} />
          </Suspense>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartCardSkeleton />}>
          <BalanceDistributionCard />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton />}>
          <ExpensesByTypeCard filter={filter} />
        </Suspense>
      </div>

      <Suspense fallback={<ChartCardSkeleton />}>
        <MonthlyFlowCard filter={filter} />
      </Suspense>

      <Suspense fallback={<ChartCardSkeleton />}>
        <DailyExpensesCard filter={dailyExpensesFilter} preset={dailyRange.preset} />
      </Suspense>

      <Suspense fallback={<ChartCardSkeleton />}>
        <UpcomingDebtsCard />
      </Suspense>

      <Suspense fallback={<ChartCardSkeleton />}>
        <BudgetsCard />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartCardSkeleton />}>
          <RecentMovementsCard filter={movementFilter} movementsHref={movementsHref} />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton />}>
          <TopExpensesCard filter={movementFilter} />
        </Suspense>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-6 w-24" />
      </CardContent>
    </Card>
  );
}

function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <ChartSkeleton />
      </CardContent>
    </Card>
  );
}
