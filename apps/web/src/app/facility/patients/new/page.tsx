import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewPatientForm from "./NewPatientForm";

export default async function NewPatientPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Detect the booker's primary facility — used to scope the new guardian
  // row so any staffer in the same facility can also access this patient.
  let facilityId: string | null = null;
  if (user) {
    const { data: row } = await supabase
      .from("facility_members")
      .select("facility_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    facilityId = (row?.facility_id as string | null) ?? null;
  }

  return <NewPatientForm facilityId={facilityId} />;
}
