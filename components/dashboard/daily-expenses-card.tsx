import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDailyExpensesByMovementType } from "@/lib/services/dashboard";
import DailyExpensesFilter from "@/components/dashboard/daily-expenses-filter";
import DailyExpensesChart from "@/components/dashboard/daily-expenses-chart";
import { DailyExpensesFilter as DailyExpensesFilterType } from "@/lib/schemas/dashboard";
import { DailyExpensesPreset } from "@/lib/dashboard/date-range";

interface Props {
  filter: DailyExpensesFilterType;
  preset: DailyExpensesPreset;
}

export default async function DailyExpensesCard({ filter, preset }: Props) {
  const { series, points, groupedCount } = await getDailyExpensesByMovementType(filter);

  const description = `Del ${formatFullDate(filter.startDate)} al ${formatFullDate(filter.endDate)}.${
    groupedCount > 0 ? " Los 8 tipos con más gasto; el resto, en Otros." : ""
  }`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos diarios por tipo</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DailyExpensesFilter
          preset={preset}
          startDate={filter.startDate}
          endDate={filter.endDate}
          showAllTypes={filter.showAllTypes}
          groupedCount={groupedCount}
        />
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay gastos registrados en este período.
          </p>
        ) : (
          <DailyExpensesChart series={series} points={points} />
        )}
      </CardContent>
    </Card>
  );
}

function formatFullDate(day: string): string {
  const [year, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}/${year}`;
}
