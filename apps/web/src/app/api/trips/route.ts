import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { billing, validators } from "@encorecare/shared";

const inputSchema = z.object({
  patientId: z.string().uuid(),
  scheduledPickupAt: z.string(),
  appointmentAt: z.string().optional().nullable(),
  pickup: validators.resolvedAddressSchema,
  dropoff: validators.resolvedAddressSchema,
  tripType: z.enum(["one_way", "round_trip", "will_call_return"]),
  mobility: z.enum(["ambulatory", "wheelchair", "wheelchair_power", "stretcher", "bariatric"]),
  needsAttendant: z.boolean().default(false),
  needsOxygen: z.boolean().default(false),
  payerType: z.enum([
    "private_pay", "medicaid", "medicare", "mco",
    "waiver_program", "va", "workers_comp", "facility_billed",
  ]),
  loadedMiles: z.number().nonnegative().nullable().optional(),
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

  // Persist both addresses with full geo data. RLS lets the user insert their own.
  const insertAddress = async (a: typeof body.pickup) => {
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        owner_id: user.id,
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
    return { data, error };
  };

  const pickupRes = await insertAddress(body.pickup);
  if (pickupRes.error || !pickupRes.data) {
    return NextResponse.json({ error: pickupRes.error?.message ?? "pickup failed" }, { status: 400 });
  }
  const dropoffRes = await insertAddress(body.dropoff);
  if (dropoffRes.error || !dropoffRes.data) {
    return NextResponse.json({ error: dropoffRes.error?.message ?? "dropoff failed" }, { status: 400 });
  }

  const hcpcs = billing.defaultHcpcsForMobility(body.mobility);

  // Compute private-pay fare if that's the payer type. Care-plan trips have
  // the claim amount set later when we build the 837P (different rate card).
  let baseCents = 0;
  let mileageCents = 0;
  let totalCents = 0;
  if (body.payerType === "private_pay" && body.loadedMiles != null) {
    const q = billing.quotePrivatePay({
      mobility: body.mobility,
      loadedMiles: body.loadedMiles,
      needsAttendant: body.needsAttendant,
      needsOxygen: body.needsOxygen,
      scheduledPickupAt: new Date(body.scheduledPickupAt),
      roundTrip: body.tripType === "round_trip",
    });
    baseCents = q.baseFareCents;
    mileageCents = q.mileageFareCents;
    totalCents = q.totalCents;
  }

  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .insert({
      patient_id: body.patientId,
      booked_by_user_id: user.id,
      trip_type: body.tripType,
      status: "requested",
      scheduled_pickup_at: body.scheduledPickupAt,
      appointment_at: body.appointmentAt ?? null,
      pickup_address_id: pickupRes.data.id,
      dropoff_address_id: dropoffRes.data.id,
      mobility: body.mobility,
      needs_attendant: body.needsAttendant,
      needs_oxygen: body.needsOxygen,
      payer_type: body.payerType,
      hcpcs_code: hcpcs,
      loaded_miles: body.loadedMiles ?? null,
      base_fare_cents: baseCents || null,
      mileage_fare_cents: mileageCents || null,
      total_fare_cents: totalCents || null,
      special_instructions: body.specialInstructions ?? null,
    })
    .select("id")
    .single();

  if (tripErr || !trip) {
    return NextResponse.json({ error: tripErr?.message ?? "trip insert failed" }, { status: 400 });
  }

  return NextResponse.json({ tripId: trip.id });
}
