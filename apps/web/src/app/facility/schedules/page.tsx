import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ScheduleActions from "./ScheduleActions";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SchedulesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: schedules } = await supabase
    .from("recurring_schedules")
    .select(`
      id, label, pickup_time_local, days_of_week, start_date, end_date,
      active, last_generated_through,
      patient:patients(first_name, last_name),
      trips(count)
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
          const tripCount = Array.isArray(s.trips) ? (s.trips[0]?.count as number) ?? 0 : 0;
          return (
            <div key={s.id as string} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold">{s.label as string}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {patient?.last_name}, {patient?.first_name} · {s.pickup_time_local as string}
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
                  <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-500">
                    <span>
                      {String(s.start_date)}
                      {s.end_date ? ` → ${String(s.end_date)}` : " → indefinite"}
                    </span>
                    <span>{tripCount} trip{tripCount === 1 ? "" : "s"} generated</span>
                    {s.last_generated_through && (
                      <span>through {String(s.last_generated_through)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s.active ? "Active" : "Paused"}
                  </span>
                  <ScheduleActions id={s.id as string} active={s.active as boolean} />
                </div>
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
