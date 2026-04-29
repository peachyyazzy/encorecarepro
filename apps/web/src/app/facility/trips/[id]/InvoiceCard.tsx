"use client";

import { useState } from "react";

interface Props {
  tripId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

export default function InvoiceCard({
  tripId,
  invoiceId,
  invoiceNumber,
  invoiceStatus,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateAndOpen() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't generate invoice");
      return;
    }
    const { url } = await res.json();
    window.open(url, "_blank", "noopener");
  }

  async function downloadExisting() {
    if (!invoiceId) return;
    // Always re-sign the URL on the server so links don't go stale.
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invoices/${invoiceId}/download?json=1`);
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't fetch download link");
      return;
    }
    const { url } = await res.json();
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Invoice / superbill
          </div>
          {invoiceNumber ? (
            <div className="mt-1 font-mono text-sm">{invoiceNumber}</div>
          ) : (
            <div className="mt-1 text-sm text-slate-500">
              Not generated yet. Generate one at any time — auto-generates on
              trip completion.
            </div>
          )}
          {invoiceStatus && (
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              Status: {invoiceStatus}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {invoiceId ? (
            <>
              <button
                type="button"
                onClick={downloadExisting}
                disabled={busy}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? "…" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={generateAndOpen}
                disabled={busy}
                className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
              >
                Regenerate
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={generateAndOpen}
              disabled={busy}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? "Generating…" : "Generate invoice"}
            </button>
          )}
        </div>
      </div>
      {error && <div className="mt-2 text-xs text-red-700">{error}</div>}
    </div>
  );
}
