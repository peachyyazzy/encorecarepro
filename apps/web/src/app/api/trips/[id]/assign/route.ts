import { NextResponse } from "next/server";
import { z } from "zod";
import { trips as tripFsm, type TripStatus } from "@encorecare/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createAdminClient } from "@/lib/supabase/service";
import { logPhiAccess, requestContext } from "@/lib/audit";

const inputSchema = z.object({
  driverId: z.string().uuid().nullable(),
  vehicleId: z.string().uuid().optional().nullable(),
});

/**
 * Admin / dispatcher assigns (or unassigns) a driver to a trip. Moves the
 * trip into `assigned`. Setting driverId=null moves it back to `scheduled`
 * for re-dispatch.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await getAuthUser(request);
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  let body: z.infer<typeof inputSchema>;
  try {
    body = inputSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "invalid input", details: String(err) }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authed.userId)
    .maybeSingle();
  const role = profile?.role as string | undefined;
  if (role !== "admin" && role !== "dispatcher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id, status, assigned_driver_id")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });

  const fromStatus = trip.status as TripStatus;
  const toStatus: TripStatus = body.driverId ? "assigned" : "scheduled";

  // Only invoke the FSM when the status actually changes.
  if (fromStatus !== toStatus) {
    try {
      tripFsm.assertTransition(fromStatus, toStatus, { role: "admin" });
    } catch (err) {
      if (err instanceof tripFsm.InvalidTripTransition) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }
  }

  const admin = createAdminClient();

  const { error: updateErr } = await admin
    .from("trips")
    .update({
      assigned_driver_id: body.driverId,
      assigned_vehicle_id: body.vehicleId ?? null,
      status: toStatus,
    })
    .eq("id", tripId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  if (fromStatus !== toStatus) {
    await admin.from("trip_events").insert({
      trip_id: tripId,
      from_status: fromStatus,
      to_status: toStatus,
      actor_user_id: authed.userId,
      note: body.driverId ? "Driver assigned" : "Driver unassigned",
    });
  }

  await logPhiAccess({
    actorUserId: authed.userId,
    actorRole: role,
    action: "update",
    resourceType: "trip",
    resourceId: tripId,
    details: { assigned_driver_id: body.driverId, prev_driver_id: trip.assigned_driver_id },
    ...requestContext(request),
  });

  return NextResponse.json({ ok: true, status: toStatus });
}
