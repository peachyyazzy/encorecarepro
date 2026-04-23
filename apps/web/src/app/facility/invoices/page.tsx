import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function InvoicesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_cents, issued_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <p className="mt-1 text-sm text-slate-600">
        Download any invoice as a claim-ready superbill.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(invoices ?? []).map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-mono">{i.invoice_number}</td>
                <td className="px-4 py-3 text-slate-600">
                  {i.issued_at ? new Date(i.issued_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">${(i.total_cents / 100).toFixed(2)}</td>
                <td className="px-4 py-3 capitalize">{i.status}</td>
              </tr>
            ))}
            {(invoices ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
