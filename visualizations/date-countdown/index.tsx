const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  done: boolean;
}

export type PrecisionTier = 'days' | 'dhm' | 'ms';

export function computeTimeRemaining(targetDate: string, now: number): TimeRemaining {
  const targetMs = new Date(targetDate).getTime();
  const totalMs = Math.max(0, targetMs - now);
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, done: true };
  }
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalMs, done: false };
}

export function getPrecisionTier(totalMs: number): PrecisionTier {
  if (totalMs >= TWO_DAYS_MS) return 'days';
  if (totalMs >= ONE_HOUR_MS) return 'dhm';
  return 'ms';
}
