"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Driver {
  id: string;
  name: string;
  rating: number | null;
}

export default function DispatchAssign({
  tripId,
  currentDriverId,
  drivers,
}: {
  tripId: string;
  currentDriverId: string | null;
  drivers: Driver[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function assign(driverId: string | null) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/trips/${tripId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? "Couldn't assign");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={currentDriverId ?? ""}
        onChange={(e) => void assign(e.target.value || null)}
        disabled={busy}
        className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:border-brand-500 focus:outline-none"
      >
        <option value="">Unassigned</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}{d.rating ? ` · ${d.rating.toFixed(1)}★` : ""}
          </option>
        ))}
      </select>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
