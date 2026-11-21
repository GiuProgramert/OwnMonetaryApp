import { CalendarWeek } from "@/lib/movements/calendar";
import { getCalendarMovements } from "@/lib/services/movements";
import MovementsCalendar from "@/components/movements/calendar/movements-calendar";
import WeekNav from "@/components/movements/calendar/week-nav";

interface Props {
  /** uuid o `undefined` ("todas"): el centinela `"all"` nunca llega al servicio. */
  accountId: string | undefined;
  accountParam: string;
  movementTypeId: string | undefined;
  week: CalendarWeek;
  today: string;
}

export default async function CalendarView({
  accountId,
  accountParam,
  movementTypeId,
  week,
  today,
}: Props) {
  const { data, truncated } = await getCalendarMovements({
    accountId,
    movementTypeId,
    startDate: week.startDate,
    endDate: week.endDate,
  });

  return (
    <div className="space-y-3">
      <WeekNav
        label={week.label}
        prevWeek={week.prevWeek}
        nextWeek={week.nextWeek}
        today={today}
        accountParam={accountParam}
        movementTypeId={movementTypeId}
      />
      {truncated && (
        <p className="text-sm text-muted-foreground">
          Se muestran los primeros 1000 movimientos de esta semana.
        </p>
      )}
      {data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay movimientos en esta semana.
        </p>
      )}
      <MovementsCalendar
        movements={data}
        days={week.days}
        selectedDay={week.selectedDay}
        today={today}
      />
    </div>
  );
}
