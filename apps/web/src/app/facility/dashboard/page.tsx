import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function FacilityDashboardPage() {
  const supabase = await createSupabaseServerClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [{ count: todayCount }, { count: upcomingCount }, { count: patientCount }] =
    await Promise.all([
      supabase
        .from("trips")
        .select("*", { count: "exact", head: true })
        .gte("scheduled_pickup_at", today.toISOString())
        .lt("scheduled_pickup_at", tomorrow.toISOString()),
      supabase
        .from("trips")
        .select("*", { count: "exact", head: true })
        .gte("scheduled_pickup_at", tomorrow.toISOString()),
      supabase.from("patients").select("*", { count: "exact", head: true }),
    ]);

  return (
    <div>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Your facility at a glance.</p>
        </div>
        <Link
          href="/facility/book"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Book a trip
        </Link>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <StatCard label="Trips today" value={todayCount ?? 0} />
        <StatCard label="Upcoming trips" value={upcomingCount ?? 0} />
        <StatCard label="Patients" value={patientCount ?? 0} />
      </section>

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link href="/facility/book" className="text-brand-700 hover:underline">
              Book a one-off trip for a patient →
            </Link>
          </li>
          <li>
            <Link href="/facility/schedules/new" className="text-brand-700 hover:underline">
              Set up a recurring schedule (dialysis, PT, infusions) →
            </Link>
          </li>
          <li>
            <Link href="/facility/patients/new" className="text-brand-700 hover:underline">
              Add a new patient →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
