/**
 * Recurring-schedule trip materialization.
 *
 * Pure function: given a schedule template and a horizon date, return every
 * pickup slot that should be generated. The caller (cron route) inserts
 * trip rows and relies on the unique index on
 * (recurring_schedule_id, scheduled_pickup_at) to make insertion safe under
 * retries / overlapping runs.
 */

import { addDays, getDay, isAfter, isBefore, set, startOfDay } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

export interface RecurringTemplate {
  id: string;
  daysOfWeek: number[];          // 0 = Sunday … 6 = Saturday
  pickupTimeLocal: string;       // "HH:MM" in the template timezone
  timezone: string;              // IANA tz, e.g. "America/New_York"
  startDate: Date;
  endDate: Date | null;
  skipDates: Date[];
  lastGeneratedThrough: Date | null;
}

export interface MaterializedSlot {
  scheduledPickupAt: Date;       // UTC instant
  serviceDate: string;           // YYYY-MM-DD in template tz (for billing)
}

const DAY_KEY = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Generate every pickup slot from `template` that falls on or before `through`.
 * Skips days already materialized (per `lastGeneratedThrough`), days outside
 * the schedule window, days not in `daysOfWeek`, and days listed in
 * `skipDates`.
 */
export function computeSlots(
  template: RecurringTemplate,
  through: Date,
): MaterializedSlot[] {
  const cursorStart = template.lastGeneratedThrough
    ? addDays(startOfDay(template.lastGeneratedThrough), 1)
    : startOfDay(template.startDate);

  const horizon = template.endDate && isBefore(template.endDate, through)
    ? startOfDay(template.endDate)
    : startOfDay(through);

  if (isAfter(cursorStart, horizon)) return [];

  const skipSet = new Set(template.skipDates.map(DAY_KEY));
  const [hh, mm] = template.pickupTimeLocal.split(":").map((n) => Number.parseInt(n, 10));

  const slots: MaterializedSlot[] = [];
  for (let d = cursorStart; !isAfter(d, horizon); d = addDays(d, 1)) {
    if (!template.daysOfWeek.includes(getDay(d))) continue;
    const dateKey = DAY_KEY(d);
    if (skipSet.has(dateKey)) continue;

    const localPickup = set(d, {
      hours: hh,
      minutes: mm,
      seconds: 0,
      milliseconds: 0,
    });
    slots.push({
      scheduledPickupAt: fromZonedTime(localPickup, template.timezone),
      serviceDate: dateKey,
    });
  }
  return slots;
}
