import BookTripForm from "./BookTripForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BookTripPage() {
  const supabase = await createSupabaseServerClient();
  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, date_of_birth, mobility")
    .order("last_name");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Book a trip</h1>
      <p className="mt-1 text-sm text-slate-600">
        Schedule a one-off ride. For recurring trips (dialysis, PT),{" "}
        <a href="/facility/schedules/new" className="text-brand-700 hover:underline">
          use a recurring schedule
        </a>{" "}
        instead.
      </p>
      <BookTripForm patients={patients ?? []} />
    </div>
  );
}
