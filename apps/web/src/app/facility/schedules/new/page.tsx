import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewScheduleForm from "./NewScheduleForm";

export default async function NewSchedulePage() {
  const supabase = await createSupabaseServerClient();
  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, date_of_birth, mobility")
    .order("last_name");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">New recurring schedule</h1>
      <p className="mt-1 text-sm text-slate-600">
        Set the days, time, and addresses once. We&apos;ll auto-generate every
        trip up to 30 days out and keep extending the window each night.
      </p>
      <NewScheduleForm patients={patients ?? []} />
    </div>
  );
}
