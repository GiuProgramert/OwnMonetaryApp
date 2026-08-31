"use client";

import { Bar, CartesianGrid, Line, ComposedChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from "@/components/ui/chart";
import { MonthlyFlow } from "@/lib/schemas/dashboard";
import { formatCurrency, formatCompactAmount } from "@/lib/dashboard/format";

interface Props {
  flow: MonthlyFlow[];
}

const chartConfig: ChartConfig = {
  income: { label: "Ingresos", color: "var(--chart-2)" },
  expense: { label: "Egresos", color: "var(--chart-5)" },
  net: { label: "Balance neto", color: "var(--chart-3)" },
};

export default function MonthlyFlowChart({ flow }: Props) {
  return (
    <ChartContainer config={chartConfig} className="w-full">
      <ComposedChart data={flow} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
        <YAxis tickFormatter={formatCompactAmount} tickLine={false} axisLine={false} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={4} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
        <Line dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ChartContainer>
  );
}
