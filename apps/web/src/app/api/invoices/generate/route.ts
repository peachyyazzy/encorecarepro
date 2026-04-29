import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createAdminClient } from "@/lib/supabase/service";
import { generateInvoiceForTrip, signInvoiceDownload } from "@/lib/invoices";
import { logPhiAccess, requestContext } from "@/lib/audit";

const inputSchema = z.object({
  tripId: z.string().uuid(),
});

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

/**
 * Generate (or refresh) the invoice PDF for a trip and return a signed
 * download URL. Caller must be a guardian/booker of the patient or
 * admin/dispatcher.
 */
export async function POST(request: Request) {
  const authed = await getAuthUser(request);
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  let body: z.infer<typeof inputSchema>;
  try {
    body = inputSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid input", details: String(err) },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Access check: caller must be able to read the trip via RLS-like rules.
  // Use the admin client because we may be Bearer-only (mobile).
  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("id, patient_id, booked_by_user_id, booked_by_facility_id")
    .eq("id", body.tripId)
    .maybeSingle();
  if (!trip) {
    return NextResponse.json({ error: "trip not found" }, { status: 404, headers: corsHeaders() });
  }

  const allowed = await callerCanAccessTrip(authed.userId, trip);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: corsHeaders() });
  }

  let result;
  try {
    result = await generateInvoiceForTrip(body.tripId, { actorUserId: authed.userId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400, headers: corsHeaders() },
    );
  }

  await logPhiAccess({
    actorUserId: authed.userId,
    action: "export",
    resourceType: "invoice",
    resourceId: result.invoiceId,
    details: { trip_id: body.tripId, invoice_number: result.invoiceNumber },
    ...requestContext(request),
  });

  const signedUrl = await signInvoiceDownload(result.pdfPath);
  return NextResponse.json(
    {
      invoiceId: result.invoiceId,
      invoiceNumber: result.invoiceNumber,
      url: signedUrl,
    },
    { headers: corsHeaders() },
  );
}

async function callerCanAccessTrip(
  userId: string,
  trip: { patient_id: string; booked_by_user_id: string | null; booked_by_facility_id: string | null },
): Promise<boolean> {
  const admin = createAdminClient();

  // Admin / dispatcher always.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = profile?.role as string | undefined;
  if (role === "admin" || role === "dispatcher") return true;

  // Booker themselves.
  if (trip.booked_by_user_id === userId) return true;

  // Patient guardian (user-scoped).
  const { data: userGuardian } = await admin
    .from("patient_guardians")
    .select("patient_id")
    .eq("patient_id", trip.patient_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (userGuardian) return true;

  // Facility staff at the booking facility (or any facility that's a guardian).
  const { data: memberships } = await admin
    .from("facility_members")
    .select("facility_id")
    .eq("user_id", userId);
  const myFacilityIds = new Set((memberships ?? []).map((m) => m.facility_id as string));
  if (trip.booked_by_facility_id && myFacilityIds.has(trip.booked_by_facility_id)) return true;

  if (myFacilityIds.size > 0) {
    const { data: facilityGuardian } = await admin
      .from("patient_guardians")
      .select("facility_id")
      .eq("patient_id", trip.patient_id)
      .in("facility_id", Array.from(myFacilityIds))
      .limit(1)
      .maybeSingle();
    if (facilityGuardian) return true;
  }

  return false;
}
