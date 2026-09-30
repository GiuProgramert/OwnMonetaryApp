"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, XAxis, YAxis } from "recharts";
import type {
  BarShapeProps,
  LabelProps,
  TooltipContentProps,
  TooltipValueType,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartConfig } from "@/components/ui/chart";
import { DailyExpensesSeries, DailyExpensesPoint } from "@/lib/schemas/dashboard";
import { formatCurrency, formatCompactAmount } from "@/lib/dashboard/format";
import { useIsMobile } from "@/lib/hooks/use-media-query";

interface Props {
  /** En orden de apilado: la primera va abajo ("Otros", si está, siempre última). */
  series: DailyExpensesSeries[];
  points: DailyExpensesPoint[];
}

const STACK_ID = "day";

export default function DailyExpensesChart({ series, points }: Props) {
  const isMobile = useIsMobile();

  const chartConfig: ChartConfig = Object.fromEntries(
    series.map((s) => [s.id, { label: s.name, color: s.color }])
  );

  // Con barras angostas el total horizontal se pisa con el del día de al lado.
  const rotateTotals = points.length > (isMobile ? 10 : 31);

  // El total del día se dibuja sobre el segmento más alto con gasto, no sobre la última serie:
  // si ese tipo no gastó ese día, su segmento mide 0 y la etiqueta quedaría sin ancla fiable.
  const topSeriesByDay = points.map((point) => {
    for (let i = series.length - 1; i >= 0; i--) {
      if (Number(point[series[i].id]) > 0) {
        return series[i].id;
      }
    }
    return undefined;
  });

  return (
    <div className="grid gap-3">
      <ChartContainer config={chartConfig} className="w-full aspect-[4/3] sm:aspect-video">
        <BarChart
          data={points}
          margin={{ top: rotateTotals ? 44 : 20, left: 8, right: 8 }}
          barCategoryGap="15%"
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="dayLabel"
            tickLine={false}
            axisLine={false}
            minTickGap={16}
            interval="preserveStartEnd"
          />
          <YAxis tickFormatter={formatCompactAmount} tickLine={false} axisLine={false} />
          <ChartTooltip
            shared={false}
            cursor={false}
            content={(props) => <DailyExpensesTooltip {...props} series={series} />}
          />
          {series.map((s) => (
            <Bar
              key={s.id}
              dataKey={s.id}
              name={s.name}
              stackId={STACK_ID}
              fill={s.color}
              maxBarSize={48}
              // Sin animación: la animación de Recharts mide el largo/alto con el render anterior
              // y al cambiar de rango por `router.push` puede quedar a medias (así se cortaban las
              // líneas del gráfico anterior).
              isAnimationActive={false}
              // Con `shape` propio Recharts 3.8 no descarta los segmentos de alto 0. Si los
              // descarta, el hover y el `LabelList` reciben el índice del array filtrado en vez
              // del día: el tooltip leía otro día (o nada) y el total quedaba sin dibujar.
              // `Rectangle` no dibuja nada con alto 0.
              shape={(shapeProps: BarShapeProps) => <Rectangle {...shapeProps} />}
            >
              <LabelList
                dataKey="total"
                content={(labelProps) => (
                  <DayTotalLabel
                    {...labelProps}
                    show={topSeriesByDay[Number(labelProps.index)] === s.id}
                    vertical={rotateTotals}
                  />
                )}
              />
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
        {series.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-muted-foreground">{s.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayTotalLabel({
  x,
  y,
  width,
  value,
  show,
  vertical,
}: LabelProps & { show: boolean; vertical: boolean }) {
  const total = Number(value);

  if (!show || !total) {
    return null;
  }

  const cx = Number(x) + Number(width) / 2;
  const top = Number(y) - 4;

  return (
    <text
      x={cx}
      y={top}
      textAnchor={vertical ? "start" : "middle"}
      dominantBaseline={vertical ? "central" : "auto"}
      transform={vertical ? `rotate(-90, ${cx}, ${top})` : undefined}
      className="fill-foreground text-[10px] sm:text-xs"
    >
      {formatCompactAmount(total)}
    </text>
  );
}

type DailyExpensesTooltipProps = TooltipContentProps<TooltipValueType, string | number> & {
  series: DailyExpensesSeries[];
};

/**
 * Tooltip de un segmento (`shared={false}`): el tipo, su monto ese día y el total del día.
 */
function DailyExpensesTooltip({ active, payload, series }: DailyExpensesTooltipProps) {
  const item = payload?.[0];

  if (!active || !item || !Number(item.value)) {
    return null;
  }

  const point = item.payload as DailyExpensesPoint;
  const color = series.find((s) => s.id === item.dataKey)?.color ?? item.color;

  return (
    <div className="grid min-w-[10rem] gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatFullDate(point.day)}</div>
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
        <span className="flex-1 text-muted-foreground">{item.name}</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatCurrency(Number(item.value))}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-1.5">
        <span className="text-muted-foreground">Total del día</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatCurrency(point.total)}
        </span>
      </div>
    </div>
  );
}

function formatFullDate(day: string): string {
  const [year, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}/${year}`;
}
