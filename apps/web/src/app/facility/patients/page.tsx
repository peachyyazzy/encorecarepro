import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MOBILITY_LABELS } from "@encorecare/shared";

export default async function PatientsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, date_of_birth, phone, mobility")
    .order("last_name");

  return (
    <div>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <Link
          href="/facility/patients/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add patient
        </Link>
      </header>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Date of birth</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Mobility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(patients ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  {p.last_name}, {p.first_name}
                </td>
                <td className="px-4 py-3 text-slate-600">{p.date_of_birth}</td>
                <td className="px-4 py-3 text-slate-600">{p.phone ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {MOBILITY_LABELS[p.mobility as keyof typeof MOBILITY_LABELS]}
                </td>
              </tr>
            ))}
            {(patients ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No patients yet.{" "}
                  <Link href="/facility/patients/new" className="text-brand-700 hover:underline">
                    Add your first one →
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
