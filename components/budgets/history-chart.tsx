"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCompactAmount, formatCurrency } from "@/lib/dashboard/format";
import { BudgetHistoryRow } from "@/lib/schemas/budgets";

const chartConfig: ChartConfig = {
  amount_limit: { label: "Tope", color: "#9ca3af" },
  spent: { label: "Gastado", color: "#ef4444" },
};

interface Props {
  rows: BudgetHistoryRow[];
}

export default function BudgetHistoryChart({ rows }: Props) {
  // El servicio devuelve del más reciente al más viejo; el eje X va de izquierda a derecha.
  const data = [...rows].reverse();

  return (
    <ChartContainer config={chartConfig} className="w-full h-72">
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="monthLabel" tickLine={false} />
        <YAxis tickFormatter={formatCompactAmount} width={64} />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="amount_limit" fill="var(--color-amount_limit)" radius={4} />
        <Bar dataKey="spent" fill="var(--color-spent)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
