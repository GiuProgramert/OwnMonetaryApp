"use client";

import { Cell, Pie, PieChart, Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { AccountBalanceSlice } from "@/lib/schemas/dashboard";
import { formatCurrency, formatCompactAmount } from "@/lib/dashboard/format";
import { useIsMobile } from "@/lib/hooks/use-media-query";

interface Props {
  slices: AccountBalanceSlice[];
  total: number;
  hasNonPositive: boolean;
}

const FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export default function BalancePieChart({ slices, total, hasNonPositive }: Props) {
  const isMobile = useIsMobile();
  const chartConfig: ChartConfig = Object.fromEntries(
    slices.map((slice, index) => [
      slice.id,
      { label: slice.name, color: slice.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length] },
    ])
  );

  if (hasNonPositive) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-amber-500">
          Hay cuentas con saldo negativo; los porcentajes no aplican.
        </p>
        <ChartContainer config={chartConfig} className="w-full">
          <BarChart data={slices} layout="vertical" margin={{ left: 16 }}>
            <XAxis type="number" tickFormatter={formatCompactAmount} />
            <YAxis type="category" dataKey="name" width={isMobile ? 72 : 100} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(Number(value))}
                />
              }
            />
            <Bar dataKey="balance">
              {slices.map((slice, index) => (
                <Cell
                  key={slice.id}
                  fill={slice.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    );
  }

  const visibleSlices = slices.filter((slice) => slice.balance > 0);

  if (visibleSlices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay cuentas con saldo para mostrar.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <ChartContainer config={chartConfig} className="w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => `${name}: ${formatCurrency(Number(value))}`}
                />
              }
            />
            <Pie
              data={visibleSlices}
              dataKey="balance"
              nameKey="name"
              innerRadius="60%"
              outerRadius="90%"
              strokeWidth={2}
            >
              {visibleSlices.map((slice, index) => (
                <Cell
                  key={slice.id}
                  fill={slice.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="max-w-full truncate text-base font-semibold sm:text-lg">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
      <ul className="space-y-1">
        {visibleSlices.map((slice, index) => (
          <li key={slice.id} className="flex items-center gap-2 text-sm">
            <div
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: slice.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
              }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
              {formatCurrency(slice.balance)} ({slice.percentage.toFixed(1)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
