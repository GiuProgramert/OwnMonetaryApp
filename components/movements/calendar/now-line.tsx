"use client";

import { useState, useEffect } from "react";
import { APP_TIME_ZONE } from "@/lib/dashboard/date-range";
import { HOUR_HEIGHT } from "@/lib/movements/calendar";

function nowMinutesInAppTimeZone(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hours = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minutes = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  return hours * 60 + minutes;
}

export default function NowLine() {
  const [minutes, setMinutes] = useState(nowMinutesInAppTimeZone);

  useEffect(() => {
    const id = setInterval(() => setMinutes(nowMinutesInAppTimeZone()), 60_000);

    return () => clearInterval(id);
  }, []);

  return (
    <div
      data-now-line
      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500"
      style={{ top: (minutes / 60) * HOUR_HEIGHT }}
    >
      <div className="absolute -left-1 -top-[5px] size-2 rounded-full bg-red-500" />
    </div>
  );
}
