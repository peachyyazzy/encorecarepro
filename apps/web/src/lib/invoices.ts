import { pdf } from "@react-pdf/renderer";
import { billing } from "@encorecare/shared";
import { InvoiceDocument } from "./pdf/InvoiceDocument";
import { createAdminClient } from "./supabase/service";
import { logPhiAccess } from "./audit";

const BUCKET = "invoices";

export interface GenerateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  pdfPath: string;
}

/**
 * Generate (or regenerate) the invoice PDF for a single trip. Idempotent:
 * if an invoice already exists for the trip we update it in place rather
 * than creating duplicates.
 *
 * Steps:
 *   1. Fetch the trip + patient + addresses + driver context
 *   2. Build the structured Invoice (shared/billing/invoice.ts)
 *   3. Insert/update the invoices row + line_items
 *   4. Render the PDF
 *   5. Upload to storage at `{patient_id}/{invoice_id}.pdf`
 *   6. Stamp the storage path back onto the invoice row
 */
export async function generateInvoiceForTrip(
  tripId: string,
  options: { actorUserId?: string | null } = {},
): Promise<GenerateInvoiceResult> {
  const admin = createAdminClient();

  const { data: trip, error: tripErr } = await admin
    .from("trips")
    .select(`
      id, status, scheduled_pickup_at, actual_pickup_at, actual_dropoff_at,
      mobility, loaded_miles, hcpcs_code, base_fare_cents, mileage_fare_cents,
      total_fare_cents, payer_type, payment_status, booked_by_user_id,
      booked_by_facility_id, origin_modifier, destination_modifier,
      patient:patients(id, first_name, last_name, date_of_birth),
      pickup:addresses!trips_pickup_address_id_fkey(line1, city, state, postal_code),
      dropoff:addresses!trips_dropoff_address_id_fkey(line1, city, state, postal_code),
      insurance:insurance_profiles(payer_name, member_id)
    `)
    .eq("id", tripId)
    .maybeSingle();

  if (tripErr || !trip) {
    throw new Error(`trip not found: ${tripErr?.message ?? "no row"}`);
  }

  const patient = first(trip.patient);
  const pickup = first(trip.pickup);
  const dropoff = first(trip.dropoff);
  const insurance = first(trip.insurance);

  if (!patient || !pickup || !dropoff) {
    throw new Error("trip is missing patient or addresses");
  }
  if (!trip.total_fare_cents) {
    throw new Error("trip has no fare set");
  }

  // Resolve who's billed. Facility-billed trips bill the facility; everyone
  // else bills the booker (or the patient themselves if self-booking).
  const billedToFacilityId =
    trip.payer_type === "facility_billed" ? trip.booked_by_facility_id : null;
  const billedToUserId = billedToFacilityId ? null : trip.booked_by_user_id;

  let billedToName = `${patient.first_name} ${patient.last_name}`;
  if (billedToFacilityId) {
    const { data: f } = await admin
      .from("facilities")
      .select("name, billing_email")
      .eq("id", billedToFacilityId)
      .maybeSingle();
    if (f?.name) billedToName = f.name as string;
  } else if (billedToUserId) {
    const { data: p } = await admin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", billedToUserId)
      .maybeSingle();
    if (p) billedToName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || billedToName;
  }

  // Find or create the invoice row + claim a sequential number.
  let invoiceId: string;
  let invoiceNumber: string;
  let issuedAt: Date;

  const { data: existing } = await admin
    .from("invoice_line_items")
    .select("invoice_id")
    .eq("trip_id", tripId)
    .limit(1)
    .maybeSingle();

  if (existing?.invoice_id) {
    invoiceId = existing.invoice_id as string;
    const { data: invRow } = await admin
      .from("invoices")
      .select("invoice_number, issued_at")
      .eq("id", invoiceId)
      .maybeSingle();
    invoiceNumber = (invRow?.invoice_number as string) ?? "";
    issuedAt = invRow?.issued_at ? new Date(invRow.issued_at as string) : new Date();
  } else {
    const { data: numberRow } = await admin.rpc("next_invoice_number");
    invoiceNumber = (numberRow as unknown as string) ?? `ECP-${new Date().getFullYear()}-TEMP`;
    issuedAt = new Date();
    const { data: created, error: createErr } = await admin
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        patient_id: patient.id,
        billed_to_user_id: billedToUserId,
        billed_to_facility_id: billedToFacilityId,
        status: trip.payment_status === "paid" ? "paid" : "issued",
        subtotal_cents: trip.total_fare_cents,
        total_cents: trip.total_fare_cents,
        issued_at: issuedAt.toISOString(),
        paid_at: trip.payment_status === "paid" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      throw new Error(`invoice insert failed: ${createErr?.message}`);
    }
    invoiceId = created.id as string;
  }

  // (Re)build the line items from the trip's billing fields. Keep it
  // idempotent — clear existing lines for the trip and re-insert.
  await admin
    .from("invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("trip_id", tripId);

  const hcpcs = (trip.hcpcs_code as string | null)
    ?? billing.defaultHcpcsForMobility(trip.mobility as billing.MobilityType);
  const serviceDate = (trip.actual_pickup_at ?? trip.scheduled_pickup_at) as string;
  const dateOnly = serviceDate.slice(0, 10);
  const originMod = (trip.origin_modifier as billing.LocationModifier | null) ?? "R";
  const destMod = (trip.destination_modifier as billing.LocationModifier | null) ?? "H";
  const modifier = `${originMod}${destMod}`;

  const linesToInsert: Array<Record<string, unknown>> = [];
  if ((trip.base_fare_cents as number | null) ?? 0 > 0) {
    linesToInsert.push({
      invoice_id: invoiceId,
      trip_id: tripId,
      description: `NEMT transport — ${pickup.city} → ${dropoff.city}`,
      hcpcs_code: hcpcs,
      modifier_1: modifier,
      quantity: 1,
      unit_price_cents: trip.base_fare_cents,
      total_cents: trip.base_fare_cents,
      service_date: dateOnly,
    });
  }
  const miles = trip.loaded_miles as number | null;
  const mileageCents = trip.mileage_fare_cents as number | null;
  if (miles && mileageCents && miles > 0 && mileageCents > 0) {
    linesToInsert.push({
      invoice_id: invoiceId,
      trip_id: tripId,
      description: "Ground mileage (loaded)",
      hcpcs_code: "A0425",
      modifier_1: modifier,
      quantity: Number(miles.toFixed(1)),
      unit_price_cents: Math.round(mileageCents / Math.max(miles, 0.1)),
      total_cents: mileageCents,
      service_date: dateOnly,
    });
  }
  if (linesToInsert.length > 0) {
    await admin.from("invoice_line_items").insert(linesToInsert);
  }

  // Build the structured Invoice object the PDF renderer consumes.
  const invoice = billing.buildInvoice({
    invoiceNumber,
    issuedAt,
    provider: {
      legalName: process.env.ORG_LEGAL_NAME ?? "Encore Care NEMT",
      doingBusinessAs: process.env.ORG_DBA ?? undefined,
      addressLine1: process.env.ORG_ADDRESS_LINE1 ?? "1 Encore Way",
      city: process.env.ORG_CITY ?? "New York",
      state: process.env.ORG_STATE ?? "NY",
      postalCode: process.env.ORG_POSTAL_CODE ?? "10001",
      phone: process.env.ORG_PHONE ?? "",
      email: process.env.ORG_EMAIL ?? "billing@encorecare.org",
      taxId: process.env.ORG_TAX_ID ?? undefined,
      npi: process.env.ORG_NPI ?? undefined,
    },
    patient: {
      firstName: patient.first_name as string,
      lastName: patient.last_name as string,
      dateOfBirth: patient.date_of_birth as string,
      memberId: (insurance?.member_id as string | undefined) ?? undefined,
      payerName: (insurance?.payer_name as string | undefined) ?? undefined,
    },
    billedTo: { name: billedToName },
    trips: [
      {
        tripId,
        serviceDate: dateOnly,
        pickupTime: ((trip.actual_pickup_at ?? trip.scheduled_pickup_at) as string).slice(11, 16),
        dropoffTime: ((trip.actual_dropoff_at ?? trip.scheduled_pickup_at) as string).slice(11, 16),
        pickupAddress: `${pickup.line1}, ${pickup.city}, ${pickup.state}`,
        dropoffAddress: `${dropoff.line1}, ${dropoff.city}, ${dropoff.state}`,
        mobility: trip.mobility as billing.MobilityType,
        loadedMiles: (miles ?? 0) as number,
        originModifier: originMod,
        destinationModifier: destMod,
        driverName: "",
        vehicleDescription: "",
        baseFareCents: (trip.base_fare_cents as number | null) ?? 0,
        mileageFareCents: (trip.mileage_fare_cents as number | null) ?? 0,
        extrasCents: 0,
        totalCents: trip.total_fare_cents as number,
        hcpcsCode: hcpcs,
      },
    ],
  });

  const buffer = await pdf(
    InvoiceDocument({
      invoice,
      paid: trip.payment_status === "paid",
      payerName: insurance?.payer_name as string | undefined,
    }),
  ).toBuffer();

  const pdfPath = `${patient.id}/${invoiceId}.pdf`;
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(pdfPath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) {
    throw new Error(`storage upload failed: ${uploadErr.message}`);
  }

  await admin
    .from("invoices")
    .update({
      pdf_url: pdfPath,
      status: trip.payment_status === "paid" ? "paid" : "issued",
      issued_at: issuedAt.toISOString(),
      paid_at: trip.payment_status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", invoiceId);

  await logPhiAccess({
    actorUserId: options.actorUserId ?? null,
    action: "create",
    resourceType: "invoice",
    resourceId: invoiceId,
    details: { trip_id: tripId, invoice_number: invoiceNumber, pdf_path: pdfPath },
  });

  return { invoiceId, invoiceNumber, pdfPath };
}

/**
 * Build a short-lived signed URL the frontend can redirect to.
 */
export async function signInvoiceDownload(pdfPath: string, expiresInSec = 3600): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(pdfPath, expiresInSec, {
      download: true,
    });
  if (error || !data?.signedUrl) {
    throw new Error(`sign url failed: ${error?.message ?? "no url"}`);
  }
  return data.signedUrl;
}

function first<T>(v: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}
