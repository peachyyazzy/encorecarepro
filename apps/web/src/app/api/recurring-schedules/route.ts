import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { validators } from "@encorecare/shared";

const inputSchema = z.object({
  patientId: z.string().uuid(),
  label: z.string().min(1).max(80),
  pickup: validators.resolvedAddressSchema,
  dropoff: validators.resolvedAddressSchema,
  pickupTimeLocal: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM"),
  timezone: z.string().default("America/New_York"),
  mobility: z.enum(["ambulatory", "wheelchair", "wheelchair_power", "stretcher", "bariatric"]),
  tripType: z.enum(["one_way", "round_trip"]).default("round_trip"),
  returnPickupTimeLocal: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startDate: z.string(),                          // YYYY-MM-DD
  endDate: z.string().optional().nullable(),
  payerType: z.enum([
    "private_pay", "medicaid", "medicare", "mco",
    "waiver_program", "va", "workers_comp", "facility_billed",
  ]),
  insuranceProfileId: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  const authed = await getAuthUser(request);
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof inputSchema>;
  try {
    body = inputSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "invalid input", details: String(err) }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Persist both addresses (RLS allows the user to insert their own).
  const insertAddress = async (a: typeof body.pickup) => {
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        owner_id: authed.userId,
        line1: a.line1,
        line2: a.line2 ?? null,
        city: a.city,
        state: a.state.toUpperCase(),
        postal_code: a.postalCode,
        country: a.country.toUpperCase(),
        latitude: a.latitude,
        longitude: a.longitude,
        place_id: a.placeId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "address insert failed");
    return data.id as string;
  };

  let pickupId: string;
  let dropoffId: string;
  try {
    pickupId = await insertAddress(body.pickup);
    dropoffId = await insertAddress(body.dropoff);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  const { data: schedule, error } = await supabase
    .from("recurring_schedules")
    .insert({
      patient_id: body.patientId,
      booked_by_user_id: authed.userId,
      label: body.label,
      pickup_address_id: pickupId,
      dropoff_address_id: dropoffId,
      pickup_time_local: body.pickupTimeLocal,
      timezone: body.timezone,
      mobility: body.mobility,
      trip_type: body.tripType,
      return_pickup_time_local: body.returnPickupTimeLocal ?? null,
      days_of_week: body.daysOfWeek,
      start_date: body.startDate,
      end_date: body.endDate ?? null,
      payer_type: body.payerType,
      insurance_profile_id: body.insuranceProfileId ?? null,
      active: true,
    })
    .select("id")
    .single();

  if (error || !schedule) {
    return NextResponse.json({ error: error?.message ?? "schedule insert failed" }, { status: 400 });
  }

  return NextResponse.json({ scheduleId: schedule.id });
}
