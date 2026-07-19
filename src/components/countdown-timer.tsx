"use client";

import { useEffect, useState } from "react";

interface TimeLeft {
  hours: number;
  mins: number;
  secs: number;
}

function getTimeLeft(endsAt: number): TimeLeft | null {
  const diff = endsAt - Date.now();
  if (diff <= 0) return null;
  return {
    hours: Math.floor(diff / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    secs: Math.floor((diff % 60_000) / 1_000),
  };
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[3rem]">
      <span className="text-3xl sm:text-4xl font-bold tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
        {label}
      </span>
    </div>
  );
}

export function CountdownTimer({ endsAt }: { endsAt: number }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() =>
    getTimeLeft(endsAt),
  );

  useEffect(() => {
    const id = setInterval(
      () => setTimeLeft(getTimeLeft(endsAt)),
      1_000,
    );
    return () => clearInterval(id);
  }, [endsAt]);

  if (!timeLeft) return null;

  return (
    <div className="space-y-2 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
        Oferta expira en
      </p>
      <div className="flex items-center justify-center gap-2">
        <Unit value={timeLeft.hours} label="horas" />
        <span className="text-3xl font-bold text-muted-foreground pb-4">:</span>
        <Unit value={timeLeft.mins} label="min" />
        <span className="text-3xl font-bold text-muted-foreground pb-4">:</span>
        <Unit value={timeLeft.secs} label="seg" />
      </div>
    </div>
  );
}
