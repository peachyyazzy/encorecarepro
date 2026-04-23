import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TRIP_STATUS_LABELS, type TripStatus } from "@encorecare/shared";
import Link from "next/link";

export default async function TripsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: trips } = await supabase
    .from("trips")
    .select(`
      id, status, scheduled_pickup_at, trip_type, mobility, payer_type,
      patient:patients(first_name, last_name),
      pickup:addresses!trips_pickup_address_id_fkey(line1, city, state),
      dropoff:addresses!trips_dropoff_address_id_fkey(line1, city, state)
    `)
    .order("scheduled_pickup_at", { ascending: true })
    .limit(100);

  return (
    <div>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trips</h1>
        <Link
          href="/facility/book"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Book a trip
        </Link>
      </header>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Pickup</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">From → To</th>
              <th className="px-4 py-3">Payer</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(trips ?? []).map((t) => {
              const patient = Array.isArray(t.patient) ? t.patient[0] : t.patient;
              const pickup = Array.isArray(t.pickup) ? t.pickup[0] : t.pickup;
              const dropoff = Array.isArray(t.dropoff) ? t.dropoff[0] : t.dropoff;
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {new Date(t.scheduled_pickup_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {patient?.last_name}, {patient?.first_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {pickup?.city} → {dropoff?.city}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.payer_type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status as TripStatus} />
                  </td>
                </tr>
              );
            })}
            {(trips ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No trips yet.{" "}
                  <Link href="/facility/book" className="text-brand-700 hover:underline">
                    Book your first one →
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}
