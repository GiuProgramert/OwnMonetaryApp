export type DashboardFilter = {
  accountId: string | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
};

export type AccountBalanceSlice = {
  id: string;
  name: string;
  color: string;
  balance: number;
  percentage: number;
};

export type AccountsBalanceDistribution = {
  slices: AccountBalanceSlice[];
  total: number;
  hasNonPositive: boolean;
};

export type ExpenseByType = {
  movement_type_id: string;
  name: string;
  color: string;
  total: number;
  percentage: number;
};

export type MonthlyFlow = {
  month: string;
  monthLabel: string;
  income: number;
  expense: number;
  net: number;
};
