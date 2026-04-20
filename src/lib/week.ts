/**
 * Week utilities.
 * - Weeks run Monday -> Sunday.
 * - Submissions for NEXT week's availability are cut off at Friday 23:59 local server time.
 */

export const OPERATIONS_TIMEZONE = 'America/New_York';
export type PlanningWeekMode = 'next_week' | 'current_week';

function zonedParts(
  d = new Date(),
  timeZone = OPERATIONS_TIMEZONE,
): { year: string; month: string; day: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

export function todayISO(d = new Date(), timeZone = OPERATIONS_TIMEZONE): string {
  const p = zonedParts(d, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function minutesIntoDay(d = new Date(), timeZone = OPERATIONS_TIMEZONE): number {
  const p = zonedParts(d, timeZone);
  return Number(p.hour) * 60 + Number(p.minute);
}

export function getMondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getNextMonday(d = new Date()): Date {
  const mon = getMondayOf(d);
  mon.setDate(mon.getDate() + 7);
  return mon;
}

export function getPlanningWeekStart(mode: PlanningWeekMode, d = new Date()): Date {
  if (mode === 'current_week') {
    return getMondayOf(d);
  }
  return getNextMonday(d);
}

export function weekDates(weekStart: Date): { date: string; label: string; dow: string }[] {
  const out: { date: string; label: string; dow: string }[] = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    out.push({
      date: d.toISOString().slice(0, 10),
      label: `${days[i]} ${d.getMonth() + 1}/${d.getDate()}`,
      dow: days[i],
    });
  }
  return out;
}

/**
 * Drivers can submit availability for the upcoming week (starting next Monday)
 * up until Friday 23:59 of the current week.
 */
export function isSubmissionOpen(now = new Date()): boolean {
  const dow = now.getDay(); // 0=Sun..6=Sat
  // Mon(1) - Thu(4): always open
  // Fri(5): open until 23:59
  // Sat(6), Sun(0): closed (we've already cut off for the upcoming week)
  if (dow === 6 || dow === 0) return false;
  return true;
}

export function cutoffDescription(now = new Date()): string {
  const friday = new Date(now);
  const dow = friday.getDay();
  const diff = (5 - dow + 7) % 7; // days until Friday
  friday.setDate(friday.getDate() + diff);
  friday.setHours(23, 59, 0, 0);
  return friday.toLocaleString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const SHIFT_TIMES: Record<'morning' | 'afternoon' | 'evening', string> = {
  morning: '6:00 AM – 11:00 AM',
  afternoon: '11:00 AM – 4:00 PM',
  evening: '4:00 PM – 10:00 PM',
};
