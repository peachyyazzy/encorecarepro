"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MOBILITY_LABELS } from "@encorecare/shared";

export default function NewPatientForm({ facilityId }: { facilityId: string | null }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);

    const form = new FormData(e.currentTarget);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErr("Not signed in");
      setSubmitting(false);
      return;
    }

    const { data: patient, error } = await supabase
      .from("patients")
      .insert({
        first_name: form.get("first_name") as string,
        last_name: form.get("last_name") as string,
        date_of_birth: form.get("date_of_birth") as string,
        phone: (form.get("phone") as string) || null,
        email: (form.get("email") as string) || null,
        mobility: form.get("mobility") as string,
        needs_attendant: form.get("needs_attendant") === "on",
        needs_oxygen: form.get("needs_oxygen") === "on",
        notes: (form.get("notes") as string) || null,
      })
      .select("id")
      .single();

    if (error || !patient) {
      setErr(error?.message ?? "Failed to create patient");
      setSubmitting(false);
      return;
    }

    // If the creator is acting on behalf of a facility, scope guardianship
    // to the facility — otherwise every staffer would have to be added
    // individually. Solo bookers (family / self) get a user-scoped guardian.
    const guardian = facilityId
      ? { patient_id: patient.id, facility_id: facilityId, relationship: "facility", can_book: true }
      : { patient_id: patient.id, user_id: user.id, relationship: "self", can_book: true };

    await supabase.from("patient_guardians").insert(guardian);

    router.push(`/facility/patients`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Add patient</h1>
      {!facilityId && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You&apos;re not a member of any facility yet — this patient will be
          tied to your account only.
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <input name="first_name" required placeholder="First name" className={inputCls} />
          <input name="last_name" required placeholder="Last name" className={inputCls} />
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Date of birth</span>
          <input type="date" name="date_of_birth" required className={inputCls + " mt-1"} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <input name="phone" placeholder="Phone" className={inputCls} />
          <input name="email" type="email" placeholder="Email" className={inputCls} />
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Mobility</span>
          <select name="mobility" className={inputCls + " mt-1"} defaultValue="ambulatory">
            {Object.entries(MOBILITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="needs_attendant" /> Needs attendant
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="needs_oxygen" /> Needs oxygen
          </label>
        </div>
        <textarea name="notes" rows={3} placeholder="Clinical / accessibility notes" className={inputCls} />
        {err && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save patient"}
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
