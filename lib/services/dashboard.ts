import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/services/accounts";
import { DashboardFilter, AccountsBalanceDistribution, ExpenseByType, MonthlyFlow } from "@/lib/schemas/dashboard";

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const OTROS_TOP_N = 8;

export async function getAccountsBalanceDistribution(): Promise<AccountsBalanceDistribution> {
  const accounts = await getAccounts();

  const total = accounts.reduce((sum, account) => sum + account.current_balance, 0);
  const hasNonPositive = accounts.some((account) => account.current_balance <= 0);

  const slices = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    color: account.color,
    balance: account.current_balance,
    percentage: total > 0 ? (account.current_balance / total) * 100 : 0,
  }));

  return { slices, total, hasNonPositive };
}

export async function getExpensesByMovementType(
  filter: DashboardFilter
): Promise<ExpenseByType[]> {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase.rpc("get_expenses_by_movement_type", {
    p_account_id: filter.accountId ?? undefined,
    p_start_date: filter.startDate ?? undefined,
    p_end_date: filter.endDate ?? undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];

  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const withPercentage: ExpenseByType[] = rows.map((row) => ({
    ...row,
    percentage: total > 0 ? (row.total / total) * 100 : 0,
  }));

  if (withPercentage.length <= OTROS_TOP_N) {
    return withPercentage;
  }

  const top = withPercentage.slice(0, OTROS_TOP_N);
  const rest = withPercentage.slice(OTROS_TOP_N);
  const otrosTotal = rest.reduce((sum, row) => sum + row.total, 0);

  return [
    ...top,
    {
      movement_type_id: "otros",
      name: "Otros",
      color: "#9ca3af",
      total: otrosTotal,
      percentage: total > 0 ? (otrosTotal / total) * 100 : 0,
    },
  ];
}

export async function getMonthlyFlow(filter: DashboardFilter): Promise<MonthlyFlow[]> {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase.rpc("get_monthly_flow", {
    p_account_id: filter.accountId ?? undefined,
    p_start_date: filter.startDate ?? undefined,
    p_end_date: filter.endDate ?? undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const byMonth = new Map(rows.map((row) => [row.month.slice(0, 7), row]));

  if (!filter.startDate || !filter.endDate) {
    return rows.map((row) => toMonthlyFlow(row.month, row.income, row.expense));
  }

  const months = enumerateMonths(filter.startDate, filter.endDate);
  return months.map((month) => {
    const row = byMonth.get(month);
    return toMonthlyFlow(`${month}-01`, row?.income ?? 0, row?.expense ?? 0);
  });
}

function toMonthlyFlow(month: string, income: number, expense: number): MonthlyFlow {
  const [year, monthNumber] = month.slice(0, 7).split("-");
  const monthLabel = `${MONTH_LABELS[Number(monthNumber) - 1]} ${year}`;
  return { month: month.slice(0, 7), monthLabel, income, expense, net: income - expense };
}

function enumerateMonths(startDate: string, endDate: string): string[] {
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const [endYear, endMonth] = endDate.split("-").map(Number);

  const months: string[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}
