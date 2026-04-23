import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ trip_id?: string; session_id?: string }>;
}) {
  const { trip_id } = await searchParams;
  if (!trip_id) redirect("/");

  const supabase = await createSupabaseServerClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, scheduled_pickup_at, payment_status, total_fare_cents, status")
    .eq("id", trip_id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Payment received</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your trip is scheduled. We&apos;ll text you when a driver is assigned.
        </p>

        {trip && (
          <dl className="mt-6 space-y-3 border-t border-slate-100 pt-6 text-sm">
            <Row label="Pickup" value={new Date(trip.scheduled_pickup_at).toLocaleString()} />
            <Row
              label="Amount"
              value={trip.total_fare_cents ? `$${((trip.total_fare_cents as number) / 100).toFixed(2)}` : "—"}
            />
            <Row
              label="Payment"
              value={
                trip.payment_status === "paid"
                  ? "Paid"
                  : "Confirming…"
              }
            />
          </dl>
        )}

        <Link
          href="/facility/trips"
          className="mt-8 block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-700"
        >
          View trips
        </Link>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}
