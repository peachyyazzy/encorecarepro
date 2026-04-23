import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminHome() {
  const supabase = await createSupabaseServerClient();
  const [{ count: tripCount }, { count: claimDraftCount }, { count: claimSubmittedCount }] =
    await Promise.all([
      supabase.from("trips").select("*", { count: "exact", head: true }),
      supabase.from("claims").select("*", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("claims").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Operations overview</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card label="Total trips" value={tripCount ?? 0} />
        <Card label="Claims to submit" value={claimDraftCount ?? 0} />
        <Card label="Claims submitted" value={claimSubmittedCount ?? 0} />
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
