import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { billing } from "@encorecare/shared";

const inputSchema = z.object({
  patientId: z.string().uuid(),
  scheduledPickupAt: z.string(),
  appointmentAt: z.string().optional().nullable(),
  pickupLine1: z.string().min(1),
  pickupCity: z.string().min(1),
  pickupState: z.string().length(2),
  pickupPostal: z.string().min(5),
  dropoffLine1: z.string().min(1),
  dropoffCity: z.string().min(1),
  dropoffState: z.string().length(2),
  dropoffPostal: z.string().min(5),
  tripType: z.enum(["one_way", "round_trip", "will_call_return"]),
  mobility: z.enum(["ambulatory", "wheelchair", "wheelchair_power", "stretcher", "bariatric"]),
  needsAttendant: z.boolean().default(false),
  needsOxygen: z.boolean().default(false),
  payerType: z.enum([
    "private_pay", "medicaid", "medicare", "mco",
    "waiver_program", "va", "workers_comp", "facility_billed",
  ]),
  specialInstructions: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof inputSchema>;
  try {
    body = inputSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: String(err) }, { status: 400 });
  }

  // Create addresses (RLS lets user insert their own)
  const { data: pickup, error: pickupErr } = await supabase
    .from("addresses")
    .insert({
      owner_id: user.id,
      line1: body.pickupLine1,
      city: body.pickupCity,
      state: body.pickupState.toUpperCase(),
      postal_code: body.pickupPostal,
    })
    .select("id")
    .single();
  if (pickupErr || !pickup) {
    return NextResponse.json({ error: pickupErr?.message ?? "pickup address failed" }, { status: 400 });
  }

  const { data: dropoff, error: dropErr } = await supabase
    .from("addresses")
    .insert({
      owner_id: user.id,
      line1: body.dropoffLine1,
      city: body.dropoffCity,
      state: body.dropoffState.toUpperCase(),
      postal_code: body.dropoffPostal,
    })
    .select("id")
    .single();
  if (dropErr || !dropoff) {
    return NextResponse.json({ error: dropErr?.message ?? "dropoff address failed" }, { status: 400 });
  }

  const hcpcs = billing.defaultHcpcsForMobility(body.mobility);

  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .insert({
      patient_id: body.patientId,
      booked_by_user_id: user.id,
      trip_type: body.tripType,
      status: "requested",
      scheduled_pickup_at: body.scheduledPickupAt,
      appointment_at: body.appointmentAt ?? null,
      pickup_address_id: pickup.id,
      dropoff_address_id: dropoff.id,
      mobility: body.mobility,
      needs_attendant: body.needsAttendant,
      needs_oxygen: body.needsOxygen,
      payer_type: body.payerType,
      hcpcs_code: hcpcs,
      special_instructions: body.specialInstructions ?? null,
    })
    .select("id")
    .single();

  if (tripErr || !trip) {
    return NextResponse.json({ error: tripErr?.message ?? "trip insert failed" }, { status: 400 });
  }

  return NextResponse.json({ tripId: trip.id });
}
