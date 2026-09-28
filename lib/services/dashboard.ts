import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/services/accounts";
import { enumerateDays } from "@/lib/dashboard/date-range";
import {
  DashboardFilter,
  AccountsBalanceDistribution,
  ExpenseByType,
  MonthlyFlow,
  DailyExpensesFilter,
  DailyExpenses,
  DailyExpensesSeries,
  DailyExpensesPoint,
} from "@/lib/schemas/dashboard";

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const OTROS_TOP_N = 8;
export const OTROS_COLOR = "#9ca3af";

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
      color: OTROS_COLOR,
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

export async function getDailyExpensesByMovementType(
  filter: DailyExpensesFilter
): Promise<DailyExpenses> {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  // Rango íntegramente futuro: `resolveDailyExpensesRange` cortó `endDate` en hoy y quedó antes
  // de `startDate`.
  if (filter.endDate < filter.startDate) {
    return { series: [], points: [], groupedCount: 0 };
  }

  const { data, error } = await supabase.rpc("get_daily_expenses_by_movement_type", {
    p_account_id: filter.accountId ?? undefined,
    p_start_date: filter.startDate,
    p_end_date: filter.endDate,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const days = enumerateDays(filter.startDate, filter.endDate);

  type Row = (typeof rows)[number];
  const rowAmountsByDay = (row: Row): Map<string, number> => {
    const map = new Map<string, number>();
    row.days.forEach((day, index) => map.set(day, row.amounts[index]));
    return map;
  };

  let kept: Row[] = rows;
  let groupedCount = 0;
  let otrosByDay: Map<string, number> | null = null;

  if (!filter.showAllTypes && rows.length > OTROS_TOP_N) {
    kept = rows.slice(0, OTROS_TOP_N);
    const rest = rows.slice(OTROS_TOP_N);
    groupedCount = rest.length;

    otrosByDay = new Map();
    for (const row of rest) {
      const amountsByDay = rowAmountsByDay(row);
      for (const day of days) {
        const amount = amountsByDay.get(day) ?? 0;
        otrosByDay.set(day, (otrosByDay.get(day) ?? 0) + amount);
      }
    }
  }

  const series: DailyExpensesSeries[] = kept.map((row) => ({
    id: row.movement_type_id,
    name: row.name,
    color: row.color,
    total: row.total,
  }));

  const keptAmountsByDay = kept.map((row) => ({ id: row.movement_type_id, byDay: rowAmountsByDay(row) }));

  if (otrosByDay) {
    const otrosTotal = sumMapValues(otrosByDay);
    series.push({ id: "otros", name: "Otros", color: OTROS_COLOR, total: otrosTotal });
  }

  // `total` suma los montos ya agregados por la RPC (a lo sumo 9 por día), no filas crudas.
  const points: DailyExpensesPoint[] = days.map((day) => {
    const point: DailyExpensesPoint = { day, dayLabel: toDayLabel(day), total: 0 };
    for (const { id, byDay } of keptAmountsByDay) {
      const amount = byDay.get(day) ?? 0;
      point[id] = amount;
      point.total += amount;
    }
    if (otrosByDay) {
      const amount = otrosByDay.get(day) ?? 0;
      point.otros = amount;
      point.total += amount;
    }
    return point;
  });

  return { series, points, groupedCount };
}

function sumMapValues(byDay: Map<string, number>): number {
  let total = 0;
  for (const amount of byDay.values()) {
    total += amount;
  }
  return total;
}

function toDayLabel(day: string): string {
  const [, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}`;
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
