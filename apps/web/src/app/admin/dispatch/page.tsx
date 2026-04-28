import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TRIP_STATUS_LABELS, MOBILITY_LABELS, type TripStatus } from "@encorecare/shared";
import DispatchAssign from "./DispatchAssign";

export default async function DispatchPage() {
  const supabase = await createSupabaseServerClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);

  const [tripsRes, driversRes] = await Promise.all([
    supabase
      .from("trips")
      .select(`
        id, status, scheduled_pickup_at, mobility, payer_type,
        assigned_driver_id,
        patient:patients(first_name, last_name),
        pickup:addresses!trips_pickup_address_id_fkey(line1, city, state),
        dropoff:addresses!trips_dropoff_address_id_fkey(line1, city, state)
      `)
      .gte("scheduled_pickup_at", startOfToday.toISOString())
      .lt("scheduled_pickup_at", endOfTomorrow.toISOString())
      .in("status", ["requested", "scheduled", "assigned"])
      .order("scheduled_pickup_at"),
    supabase
      .from("drivers")
      .select(`
        id, active, rating,
        profile:profiles!drivers_user_id_fkey(first_name, last_name)
      `)
      .eq("active", true),
  ]);

  const trips = tripsRes.data ?? [];
  const driversRaw = driversRes.data ?? [];
  const drivers = driversRaw.map((d) => {
    const p = Array.isArray(d.profile) ? d.profile[0] : d.profile;
    return {
      id: d.id as string,
      name: `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "(unnamed)",
      rating: (d.rating as number | null) ?? null,
    };
  });

  return (
    <div>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dispatch board</h1>
          <p className="mt-1 text-sm text-slate-300">
            Today and tomorrow. Assign a driver to push the trip into the
            driver&apos;s manifest.
          </p>
        </div>
      </header>

      <div className="mt-8 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Pickup</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Mobility</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Driver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {trips.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No trips to dispatch in the next 48 hours.
                </td>
              </tr>
            )}
            {trips.map((t) => {
              const patient = Array.isArray(t.patient) ? t.patient[0] : t.patient;
              const pickup = Array.isArray(t.pickup) ? t.pickup[0] : t.pickup;
              const dropoff = Array.isArray(t.dropoff) ? t.dropoff[0] : t.dropoff;
              return (
                <tr key={t.id as string} className="hover:bg-slate-800/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono">
                    {new Date(t.scheduled_pickup_at as string).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {patient?.last_name}, {patient?.first_name}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {pickup?.city} → {dropoff?.city}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {MOBILITY_LABELS[t.mobility as keyof typeof MOBILITY_LABELS]}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status as TripStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <DispatchAssign
                      tripId={t.id as string}
                      currentDriverId={(t.assigned_driver_id as string | null) ?? null}
                      drivers={drivers}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TripStatus }) {
  const tone =
    status === "assigned"
      ? "bg-emerald-900/40 text-emerald-200 border-emerald-700"
      : status === "requested"
        ? "bg-amber-900/40 text-amber-200 border-amber-700"
        : "bg-slate-800 text-slate-300 border-slate-700";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}
