"use client";
import { useEffect, useState } from "react";

export default function ReservationCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) {
        window.clearInterval(timer);
        onExpire?.();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, onExpire]);
  return <strong className={seconds < 120 ? "text-red-600" : "text-violet-700"}>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</strong>;
}
