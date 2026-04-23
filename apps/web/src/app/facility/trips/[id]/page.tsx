import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TRIP_STATUS_LABELS, MOBILITY_LABELS, type TripStatus } from "@encorecare/shared";
import PayNowButton from "./PayNowButton";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: trip } = await supabase
    .from("trips")
    .select(`
      id, status, scheduled_pickup_at, appointment_at, trip_type, mobility,
      needs_attendant, needs_oxygen, special_instructions, payer_type,
      hcpcs_code, loaded_miles, base_fare_cents, mileage_fare_cents,
      total_fare_cents, payment_status, stripe_payment_intent_id,
      patient:patients(first_name, last_name, date_of_birth),
      pickup:addresses!trips_pickup_address_id_fkey(line1, city, state, postal_code),
      dropoff:addresses!trips_dropoff_address_id_fkey(line1, city, state, postal_code)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!trip) notFound();

  const patient = Array.isArray(trip.patient) ? trip.patient[0] : trip.patient;
  const pickup = Array.isArray(trip.pickup) ? trip.pickup[0] : trip.pickup;
  const dropoff = Array.isArray(trip.dropoff) ? trip.dropoff[0] : trip.dropoff;

  const unpaid =
    trip.payer_type === "private_pay" &&
    trip.payment_status !== "paid" &&
    (trip.total_fare_cents as number | null) &&
    (trip.total_fare_cents as number) > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <nav className="text-sm text-slate-500">
        <Link href="/facility/trips" className="hover:text-brand-700">← All trips</Link>
      </nav>

      <header className="mt-3 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {patient?.last_name}, {patient?.first_name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pickup {new Date(trip.scheduled_pickup_at).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={trip.status as TripStatus} />
      </header>

      {unpaid && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-amber-900">Payment required</div>
              <p className="mt-1 text-sm text-amber-800">
                This private-pay trip isn&apos;t scheduled until payment clears.
              </p>
            </div>
            <PayNowButton
              tripId={trip.id as string}
              amountCents={trip.total_fare_cents as number}
            />
          </div>
        </div>
      )}

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Route">
          <KV label="From" value={formatAddress(pickup)} />
          <KV label="To" value={formatAddress(dropoff)} />
          <KV label="Loaded miles" value={trip.loaded_miles ? `${(trip.loaded_miles as number).toFixed(1)} mi` : "—"} />
        </Card>

        <Card title="Rider">
          <KV label="Name" value={`${patient?.first_name} ${patient?.last_name}`} />
          <KV label="DOB" value={patient?.date_of_birth ?? "—"} />
          <KV label="Mobility" value={MOBILITY_LABELS[trip.mobility as keyof typeof MOBILITY_LABELS]} />
          {trip.needs_attendant && <KV label="Attendant" value="Required" />}
          {trip.needs_oxygen && <KV label="Oxygen" value="Required" />}
        </Card>

        <Card title="Billing">
          <KV label="Payer" value={String(trip.payer_type)} />
          <KV label="HCPCS" value={trip.hcpcs_code ?? "—"} />
          {trip.total_fare_cents != null && (
            <>
              <KV label="Base fare" value={formatCents(trip.base_fare_cents as number | null)} />
              <KV label="Mileage" value={formatCents(trip.mileage_fare_cents as number | null)} />
              <KV label="Total" value={formatCents(trip.total_fare_cents as number | null)} />
            </>
          )}
          <KV label="Payment status" value={String(trip.payment_status)} />
        </Card>

        {trip.special_instructions && (
          <Card title="Special instructions">
            <p className="text-sm text-slate-700">{trip.special_instructions as string}</p>
          </Card>
        )}
      </section>
    </div>
  );
}

function formatAddress(a: { line1: string; city: string; state: string; postal_code: string } | null | undefined) {
  if (!a) return "—";
  return `${a.line1}, ${a.city}, ${a.state} ${a.postal_code}`;
}

function formatCents(v: number | null | undefined) {
  if (v == null) return "—";
  return `$${(v / 100).toFixed(2)}`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: TripStatus }) {
  const color =
    status === "completed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "canceled" || status === "no_show"
        ? "bg-red-100 text-red-800"
        : status === "in_progress" || status === "driver_en_route"
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${color}`}>
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}
