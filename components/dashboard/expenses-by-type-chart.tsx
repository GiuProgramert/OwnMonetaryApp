"use client";

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { ExpenseByType } from "@/lib/schemas/dashboard";
import { formatCurrency, formatCompactAmount } from "@/lib/dashboard/format";
import { useIsMobile } from "@/lib/hooks/use-media-query";

interface Props {
  expenses: ExpenseByType[];
}

export default function ExpensesByTypeChart({ expenses }: Props) {
  const isMobile = useIsMobile();
  const chartConfig: ChartConfig = Object.fromEntries(
    expenses.map((expense) => [
      expense.movement_type_id,
      { label: expense.name, color: expense.color },
    ])
  );

  const height = Math.max(200, expenses.length * 40);
  // En móvil el eje de categorías se come casi la mitad del ancho del gráfico.
  const axisWidth = isMobile ? 72 : 120;
  const maxLabelChars = isMobile ? 10 : 18;

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <BarChart
        data={expenses}
        layout="vertical"
        margin={{ left: 8, right: isMobile ? 28 : 48 }}
      >
        <XAxis type="number" tickFormatter={formatCompactAmount} />
        <YAxis
          type="category"
          dataKey="name"
          width={axisWidth}
          tickFormatter={(value: string) =>
            value.length > maxLabelChars
              ? `${value.slice(0, maxLabelChars - 1)}…`
              : value
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />
          }
        />
        <Bar dataKey="total" radius={4}>
          {expenses.map((expense) => (
            <Cell key={expense.movement_type_id} fill={expense.color} />
          ))}
          <LabelList
            dataKey="total"
            position="right"
            formatter={(value) => formatCompactAmount(Number(value))}
            className="fill-foreground text-xs"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
