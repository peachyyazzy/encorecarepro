import { NextResponse } from "next/server";
import { z } from "zod";
import { trips as tripFsm, type TripStatus, type UserRole } from "@encorecare/shared";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createAdminClient } from "@/lib/supabase/service";
import { logPhiAccess, requestContext } from "@/lib/audit";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

const inputSchema = z.object({
  to: z.enum([
    "requested", "scheduled", "assigned", "driver_en_route",
    "driver_arrived", "in_progress", "dropped_off", "completed",
    "canceled", "no_show",
  ]),
  note: z.string().max(500).optional(),
  loadedMiles: z.number().nonnegative().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await getAuthUser(request);
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  const { id: tripId } = await params;

  let body: z.infer<typeof inputSchema>;
  try {
    body = inputSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid input", details: String(err) },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Use the admin client for reads/writes — caller is already authenticated
  // and we want this route to work for both cookie (web) and Bearer (mobile)
  // sessions. RLS would block the cookie-bound client for Bearer callers.
  const admin = createAdminClient();

  const [{ data: profile }, { data: trip }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", authed.userId).maybeSingle(),
    admin
      .from("trips")
      .select("id, status, assigned_driver_id, booked_by_user_id, patient_id")
      .eq("id", tripId)
      .maybeSingle(),
  ]);

  if (!trip) {
    return NextResponse.json({ error: "trip not found" }, { status: 404, headers: corsHeaders() });
  }

  const role = (profile?.role as UserRole | undefined) ?? "rider";

  let isAssignedDriver = false;
  if (role === "driver" && trip.assigned_driver_id) {
    const { data: driverRow } = await admin
      .from("drivers")
      .select("id")
      .eq("user_id", authed.userId)
      .maybeSingle();
    isAssignedDriver = driverRow?.id === trip.assigned_driver_id;
  }
  const isBooker = trip.booked_by_user_id === authed.userId;

  const fromStatus = trip.status as TripStatus;
  const toStatus = body.to as TripStatus;

  try {
    tripFsm.assertTransition(fromStatus, toStatus, {
      role,
      isAssignedDriver,
      isBooker,
    });
  } catch (err) {
    if (err instanceof tripFsm.InvalidTripTransition) {
      return NextResponse.json({ error: err.message }, { status: 409, headers: corsHeaders() });
    }
    return NextResponse.json({ error: "transition rejected" }, { status: 409, headers: corsHeaders() });
  }

  // Side effects per transition (timestamps + driver-reported miles).
  const update: Record<string, unknown> = { status: toStatus };
  const now = new Date().toISOString();
  if (toStatus === "driver_arrived") update.actual_pickup_at = update.actual_pickup_at ?? now;
  if (toStatus === "in_progress" && !trip.assigned_driver_id) {
    return NextResponse.json(
      { error: "trip has no driver assigned" },
      { status: 409, headers: corsHeaders() },
    );
  }
  if (toStatus === "dropped_off") update.actual_dropoff_at = now;
  if (toStatus === "completed" && body.loadedMiles != null) {
    update.loaded_miles = body.loadedMiles;
  }

  const { error: updateErr } = await admin
    .from("trips")
    .update(update)
    .eq("id", tripId)
    .eq("status", fromStatus); // optimistic-lock against concurrent transitions
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400, headers: corsHeaders() });
  }

  await admin.from("trip_events").insert({
    trip_id: tripId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_user_id: authed.userId,
    note: body.note ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
  });

  await logPhiAccess({
    actorUserId: authed.userId,
    actorRole: role,
    action: "update",
    resourceType: "trip",
    resourceId: tripId,
    details: { from: fromStatus, to: toStatus },
    ...requestContext(request),
  });

  return NextResponse.json({ ok: true, status: toStatus }, { headers: corsHeaders() });
}
