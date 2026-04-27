import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/service";
import { billing, scheduling } from "@encorecare/shared";

/**
 * Cron: materialize upcoming trips from active recurring schedules.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` — works for Vercel Cron, GitHub
 * Actions, or any external scheduler. Vercel Cron sends the secret in this
 * header automatically when you configure `vercel.json`.
 *
 * Idempotency: a unique index on (recurring_schedule_id, scheduled_pickup_at)
 * means duplicate inserts fail with 23505 and we just count them as skipped.
 *
 * Horizon: 30 days. Tune via CRON_HORIZON_DAYS env var.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HORIZON_DAYS = Number(process.env.CRON_HORIZON_DAYS ?? 30);

function authorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runMaterialization());
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runMaterialization());
}

interface RunResult {
  schedulesProcessed: number;
  tripsGenerated: number;
  tripsSkipped: number;
  errors: Array<{ scheduleId: string; message: string }>;
  horizon: string;
}

async function runMaterialization(): Promise<RunResult> {
  const admin = createAdminClient();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);

  const { data: schedules, error } = await admin
    .from("recurring_schedules")
    .select("*")
    .eq("active", true);

  const result: RunResult = {
    schedulesProcessed: 0,
    tripsGenerated: 0,
    tripsSkipped: 0,
    errors: [],
    horizon: horizon.toISOString(),
  };

  if (error) {
    result.errors.push({ scheduleId: "*", message: error.message });
    return result;
  }
  if (!schedules) return result;

  for (const s of schedules) {
    result.schedulesProcessed += 1;
    try {
      const template: scheduling.RecurringTemplate = {
        id: s.id as string,
        daysOfWeek: (s.days_of_week as number[]) ?? [],
        pickupTimeLocal: s.pickup_time_local as string,
        timezone: (s.timezone as string) ?? "America/New_York",
        startDate: new Date(s.start_date as string),
        endDate: s.end_date ? new Date(s.end_date as string) : null,
        skipDates: ((s.skip_dates as string[] | null) ?? []).map((d) => new Date(d)),
        lastGeneratedThrough: s.last_generated_through
          ? new Date(s.last_generated_through as string)
          : null,
      };

      const slots = scheduling.computeSlots(template, horizon);
      const hcpcs = billing.defaultHcpcsForMobility(s.mobility as billing.MobilityType);

      for (const slot of slots) {
        const { error: insertErr } = await admin.from("trips").insert({
          patient_id: s.patient_id,
          booked_by_user_id: s.booked_by_user_id,
          booked_by_facility_id: s.booked_by_facility_id,
          trip_type: s.trip_type,
          status: "scheduled",
          scheduled_pickup_at: slot.scheduledPickupAt.toISOString(),
          pickup_address_id: s.pickup_address_id,
          dropoff_address_id: s.dropoff_address_id,
          mobility: s.mobility,
          payer_type: s.payer_type,
          insurance_profile_id: s.insurance_profile_id,
          recurring_schedule_id: s.id,
          hcpcs_code: hcpcs,
        });
        if (insertErr) {
          // 23505 = unique violation -> already materialized for this slot
          if ((insertErr as { code?: string }).code === "23505") {
            result.tripsSkipped += 1;
          } else {
            result.errors.push({ scheduleId: s.id as string, message: insertErr.message });
          }
        } else {
          result.tripsGenerated += 1;
        }
      }

      const horizonDate = horizon.toISOString().slice(0, 10);
      await admin
        .from("recurring_schedules")
        .update({ last_generated_through: horizonDate })
        .eq("id", s.id);
    } catch (err) {
      result.errors.push({
        scheduleId: s.id as string,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
