import { createAdminClient } from "./supabase/service";
import { getAuthUser } from "./supabase/auth-user";

export interface PayableTrip {
  id: string;
  total_fare_cents: number;
  payment_status: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  booked_by_user_id: string;
  patient_id: string;
  scheduled_pickup_at: string;
}

/**
 * Fetches a trip, verifying the caller is allowed to pay for it. Returns
 * 401 / 403 / 404 errors as structured results for the route to render.
 */
export async function loadPayableTrip(
  request: Request,
  tripId: string,
): Promise<
  | { ok: true; userId: string; trip: PayableTrip }
  | { ok: false; status: number; error: string }
> {
  const authed = await getAuthUser(request);
  if (!authed) return { ok: false, status: 401, error: "unauthorized" };

  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select(`
      id, total_fare_cents, payment_status, stripe_payment_intent_id,
      stripe_checkout_session_id, booked_by_user_id, patient_id,
      scheduled_pickup_at, payer_type
    `)
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return { ok: false, status: 404, error: "trip not found" };

  // v1: only the booker can drive the payment flow (expand later for
  // authorized family members).
  if (trip.booked_by_user_id !== authed.userId) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (trip.payer_type !== "private_pay") {
    return { ok: false, status: 400, error: "trip is not private_pay" };
  }
  if (trip.payment_status === "paid") {
    return { ok: false, status: 409, error: "trip already paid" };
  }
  if (!trip.total_fare_cents || (trip.total_fare_cents as number) < 50) {
    return { ok: false, status: 400, error: "fare not set" };
  }

  return { ok: true, userId: authed.userId, trip: trip as unknown as PayableTrip };
}
