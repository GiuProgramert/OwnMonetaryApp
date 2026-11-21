import { addDays } from "@/lib/dashboard/date-range";

/**
 * Lógica pura de la vista calendario de movimientos: semanas, solapamiento de bloques y
 * conversiones minutos ↔ string. Sin React; las fechas son strings en hora local y los `Date` se
 * arman por componentes (nunca `toISOString()`).
 */

export { addDays };

export const HOUR_HEIGHT = 64;
export const EVENT_MINUTES = 30;
export const SNAP_MINUTES = 15;
export const MAX_COLUMNS = 3;
export const INITIAL_SCROLL_HOUR = 7;
export const ALL_DAY_VISIBLE = 3;

const MAX_MINUTES = 23 * 60 + 45;

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function isValidDay(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  // Ida y vuelta: `2026-02-31` se normalizaría a marzo y no coincidiría.
  return addDays(value, 0) === value;
}

function mondayOf(day: string): string {
  const [year, month, d] = day.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, d).getDay(); // 0 = domingo
  return addDays(day, -((dayOfWeek + 6) % 7));
}

function formatWeekLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);

  if (sy !== ey) {
    return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  }

  if (sm !== em) {
    return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  }

  return `${sd} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

export type CalendarWeek = {
  days: string[];
  startDate: string;
  endDate: string;
  prevWeek: string;
  nextWeek: string;
  selectedDay: string;
  label: string;
};

export function resolveCalendarWeek(
  { week, day }: { week?: string; day?: string },
  today: string
): CalendarWeek {
  let anchor = today;

  if (isValidDay(week)) {
    anchor = week;
  } else if (isValidDay(day)) {
    anchor = day;
  }

  const startDate = mondayOf(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  const endDate = days[6];

  let selectedDay = startDate;

  if (isValidDay(day) && days.includes(day)) {
    selectedDay = day;
  } else if (days.includes(today)) {
    selectedDay = today;
  }

  return {
    days,
    startDate,
    endDate,
    prevWeek: addDays(startDate, -7),
    nextWeek: addDays(startDate, 7),
    selectedDay,
    label: formatWeekLabel(startDate, endDate),
  };
}

/**
 * `movements.date` → día, minutos desde medianoche y si es "sin hora" (00:00). Sobre el string,
 * como `formatMovementDate`.
 */
export function splitMovementDate(dbValue: string): {
  day: string;
  minutes: number;
  isAllDay: boolean;
} {
  const [day, timePart] = dbValue.replace(" ", "T").split("T");
  const time = timePart?.slice(0, 5) ?? "00:00";
  const [hours, mins] = time.split(":").map(Number);
  const minutes = (hours || 0) * 60 + (mins || 0);

  return { day, minutes, isAllDay: minutes === 0 };
}

export function offsetToMinutes(offsetPx: number): number {
  const raw = (offsetPx / HOUR_HEIGHT) * 60;
  const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;

  return Math.min(MAX_MINUTES, Math.max(0, snapped));
}

export function toMovementDate(day: string, minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");

  return `${day}T${hours}:${mins}`;
}

/** `"14:30"` a partir de minutos desde medianoche. */
export function formatMinutes(minutes: number): string {
  return toMovementDate("", minutes).slice(1);
}

/** `"2026-01-07"` a `"Miércoles, 7 de enero"`, en hora local (nunca `new Date("YYYY-MM-DD")`). */
export function formatEventDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const text = new Intl.DateTimeFormat("es-PY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, date));

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type PlacedEvent<T> = { event: T; column: number; columns: number };

export type DayOverflow<T> = {
  /** Minutos del primer evento oculto del cluster: a esa altura va el chip "+N". */
  top: number;
  hidden: T[];
};

export function layoutDayEvents<T extends { id: string; minutes: number }>(
  events: T[]
): { placed: PlacedEvent<T>[]; overflow: DayOverflow<T>[] } {
  const sorted = [...events].sort(
    (a, b) => a.minutes - b.minutes || a.id.localeCompare(b.id)
  );

  const clusters: T[][] = [];
  let clusterEnd = -1;

  for (const event of sorted) {
    if (clusters.length > 0 && event.minutes < clusterEnd) {
      clusters[clusters.length - 1].push(event);
      clusterEnd = Math.max(clusterEnd, event.minutes + EVENT_MINUTES);
    } else {
      clusters.push([event]);
      clusterEnd = event.minutes + EVENT_MINUTES;
    }
  }

  const placed: PlacedEvent<T>[] = [];
  const overflow: DayOverflow<T>[] = [];

  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    const assigned: { event: T; column: number }[] = [];

    for (const event of cluster) {
      let column = columnEnds.findIndex((end) => end <= event.minutes);

      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(0);
      }

      columnEnds[column] = event.minutes + EVENT_MINUTES;
      assigned.push({ event, column });
    }

    const needsOverflow = columnEnds.length > MAX_COLUMNS;
    const columns = needsOverflow ? MAX_COLUMNS : columnEnds.length;
    const hidden: T[] = [];

    for (const { event, column } of assigned) {
      if (needsOverflow && column >= MAX_COLUMNS - 1) {
        hidden.push(event);
      } else {
        placed.push({ event, column, columns });
      }
    }

    if (hidden.length > 0) {
      overflow.push({ top: hidden[0].minutes, hidden });
    }
  }

  return { placed, overflow };
}
