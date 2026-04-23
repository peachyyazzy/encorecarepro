"use client";

import { useState } from "react";

export default function PayNowButton({
  tripId,
  amountCents,
}: {
  tripId: string;
  amountCents: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payments/checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    if (!res.ok) {
      setLoading(false);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Checkout failed");
      return;
    }
    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={loading}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? "Starting…" : `Pay $${(amountCents / 100).toFixed(2)}`}
      </button>
      {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
    </div>
  );
}
