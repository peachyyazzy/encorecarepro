import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SchedulesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: schedules } = await supabase
    .from("recurring_schedules")
    .select(`
      id, label, pickup_time_local, days_of_week, start_date, end_date, active,
      patient:patients(first_name, last_name)
    `)
    .order("created_at", { ascending: false });

  return (
    <div>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recurring schedules</h1>
        <Link
          href="/facility/schedules/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New schedule
        </Link>
      </header>

      <div className="mt-6 grid gap-4">
        {(schedules ?? []).map((s) => {
          const patient = Array.isArray(s.patient) ? s.patient[0] : s.patient;
          const days = (s.days_of_week as number[] | null) ?? [];
          return (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold">{s.label}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {patient?.last_name}, {patient?.first_name} · {s.pickup_time_local}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {DAY_LABELS.map((d, i) => (
                      <span
                        key={i}
                        className={`rounded px-2 py-0.5 text-xs ${
                          days.includes(i)
                            ? "bg-brand-100 text-brand-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {s.start_date} {s.end_date ? `→ ${s.end_date}` : "→ indefinite"}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    s.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {s.active ? "Active" : "Paused"}
                </span>
              </div>
            </div>
          );
        })}
        {(schedules ?? []).length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            No recurring schedules yet.{" "}
            <Link href="/facility/schedules/new" className="text-brand-700 hover:underline">
              Create one →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
