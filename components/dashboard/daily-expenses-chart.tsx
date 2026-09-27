"use client";

import type { ComponentProps } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from "@/components/ui/chart";
import { DailyExpensesSeries, DailyExpensesPoint } from "@/lib/schemas/dashboard";
import { formatCurrency, formatCompactAmount } from "@/lib/dashboard/format";

interface Props {
  series: DailyExpensesSeries[];
  points: DailyExpensesPoint[];
}

export default function DailyExpensesChart({ series, points }: Props) {
  const chartConfig: ChartConfig = Object.fromEntries(
    series.map((s) => [s.id, { label: s.name, color: s.color }])
  );

  const showDots = points.length <= 14;

  return (
    <ChartContainer config={chartConfig} className="w-full aspect-[4/3] sm:aspect-video">
      <LineChart data={points} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="dayLabel"
          tickLine={false}
          axisLine={false}
          minTickGap={16}
          interval="preserveStartEnd"
        />
        <YAxis tickFormatter={formatCompactAmount} tickLine={false} axisLine={false} />
        <ChartTooltip content={<DailyExpensesTooltip />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Line
            key={s.id}
            dataKey={s.id}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            type="monotone"
            dot={showDots}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

type DailyExpensesTooltipProps = ComponentProps<typeof ChartTooltipContent>;

/**
 * Tooltip propio: filtra los tipos en 0 ese día y ordena por monto (mayor primero), porque
 * `ChartTooltipContent` con `formatter` reemplaza la fila entera y con 8+ líneas sería una lista
 * de ceros sin orden (ver plan, restricción 9 y punto 3.4).
 */
function DailyExpensesTooltip(props: DailyExpensesTooltipProps) {
  const { active, payload, label } = props;

  if (!active || !payload?.length) {
    return null;
  }

  const filtered = payload
    .filter((item) => Number(item.value) !== 0)
    .sort((a, b) => Number(b.value) - Number(a.value));

  if (filtered.length === 0) {
    return null;
  }

  const dayLabel = typeof label === "string" ? formatFullDate(filtered[0].payload?.day ?? label) : "";

  return (
    <ChartTooltipContent
      {...props}
      payload={filtered}
      labelFormatter={() => dayLabel}
      formatter={(value, name, item) => (
        <>
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          <div className="flex flex-1 justify-between leading-none items-center">
            <span className="text-muted-foreground">{name}</span>
            <span className="ml-2 font-mono font-medium text-foreground tabular-nums">
              {formatCurrency(Number(value))}
            </span>
          </div>
        </>
      )}
    />
  );
}

function formatFullDate(day: string): string {
  const [year, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}/${year}`;
}
