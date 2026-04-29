import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createAdminClient } from "@/lib/supabase/service";
import { signInvoiceDownload } from "@/lib/invoices";
import { logPhiAccess, requestContext } from "@/lib/audit";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/**
 * Returns a fresh signed URL to download the invoice PDF. The browser/app
 * follows the redirect (default) or, with ?json=1, gets the URL as JSON.
 *
 * Re-signs every call so URLs don't sit around long. The PDF must already
 * have been generated — call POST /api/invoices/generate first.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await getAuthUser(request);
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  const { id: invoiceId } = await params;
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, patient_id, billed_to_user_id, billed_to_facility_id, pdf_url")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice || !invoice.pdf_url) {
    return NextResponse.json(
      { error: "invoice or PDF not found" },
      { status: 404, headers: corsHeaders() },
    );
  }

  // Same access logic as the generate route — duplicated to avoid an extra
  // round-trip via the trip table.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", authed.userId)
    .maybeSingle();
  const role = profile?.role as string | undefined;
  const isAdmin = role === "admin" || role === "dispatcher";

  let allowed = isAdmin || invoice.billed_to_user_id === authed.userId;
  if (!allowed && invoice.billed_to_facility_id) {
    const { data: m } = await admin
      .from("facility_members")
      .select("facility_id")
      .eq("user_id", authed.userId)
      .eq("facility_id", invoice.billed_to_facility_id)
      .maybeSingle();
    allowed = !!m;
  }
  if (!allowed) {
    const { data: g } = await admin
      .from("patient_guardians")
      .select("patient_id")
      .eq("patient_id", invoice.patient_id)
      .eq("user_id", authed.userId)
      .maybeSingle();
    allowed = !!g;
  }
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: corsHeaders() });
  }

  const signed = await signInvoiceDownload(invoice.pdf_url as string);

  await logPhiAccess({
    actorUserId: authed.userId,
    actorRole: role ?? null,
    action: "export",
    resourceType: "invoice",
    resourceId: invoiceId,
    ...requestContext(request),
  });

  const json = new URL(request.url).searchParams.get("json") === "1";
  if (json) {
    return NextResponse.json({ url: signed }, { headers: corsHeaders() });
  }
  return NextResponse.redirect(signed, { status: 302 });
}
