"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MOBILITY_LABELS } from "@encorecare/shared";

interface PatientOption {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  mobility: keyof typeof MOBILITY_LABELS;
}

export default function BookTripForm({ patients }: { patients: PatientOption[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      patientId: form.get("patientId"),
      scheduledPickupAt: form.get("scheduledPickupAt"),
      appointmentAt: form.get("appointmentAt") || null,
      pickupLine1: form.get("pickupLine1"),
      pickupCity: form.get("pickupCity"),
      pickupState: form.get("pickupState"),
      pickupPostal: form.get("pickupPostal"),
      dropoffLine1: form.get("dropoffLine1"),
      dropoffCity: form.get("dropoffCity"),
      dropoffState: form.get("dropoffState"),
      dropoffPostal: form.get("dropoffPostal"),
      tripType: form.get("tripType"),
      mobility: form.get("mobility"),
      needsAttendant: form.get("needsAttendant") === "on",
      needsOxygen: form.get("needsOxygen") === "on",
      payerType: form.get("payerType"),
      specialInstructions: form.get("specialInstructions"),
    };

    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    const { tripId } = await res.json();
    router.push(`/facility/trips/${tripId}`);
  }

  if (patients.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Add a patient first.{" "}
        <a href="/facility/patients/new" className="text-brand-700 hover:underline">
          Add a patient →
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <Field label="Patient">
        <select name="patientId" required className={inputCls}>
          <option value="">Select patient…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.last_name}, {p.first_name} ({p.date_of_birth})
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Pickup date & time">
          <input type="datetime-local" name="scheduledPickupAt" required className={inputCls} />
        </Field>
        <Field label="Appointment time (optional)">
          <input type="datetime-local" name="appointmentAt" className={inputCls} />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Pickup address</legend>
        <input name="pickupLine1" placeholder="Street address" required className={inputCls} />
        <div className="grid grid-cols-3 gap-3">
          <input name="pickupCity" placeholder="City" required className={inputCls} />
          <input name="pickupState" placeholder="ST" required maxLength={2} className={inputCls} />
          <input name="pickupPostal" placeholder="ZIP" required className={inputCls} />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Drop-off address</legend>
        <input name="dropoffLine1" placeholder="Street address" required className={inputCls} />
        <div className="grid grid-cols-3 gap-3">
          <input name="dropoffCity" placeholder="City" required className={inputCls} />
          <input name="dropoffState" placeholder="ST" required maxLength={2} className={inputCls} />
          <input name="dropoffPostal" placeholder="ZIP" required className={inputCls} />
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Trip type">
          <select name="tripType" className={inputCls} defaultValue="one_way">
            <option value="one_way">One way</option>
            <option value="round_trip">Round trip</option>
            <option value="will_call_return">Will-call return</option>
          </select>
        </Field>
        <Field label="Mobility">
          <select name="mobility" className={inputCls} defaultValue="ambulatory">
            {Object.entries(MOBILITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needsAttendant" /> Needs attendant
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needsOxygen" /> Needs oxygen
        </label>
      </div>

      <Field label="How will this trip be paid?">
        <select name="payerType" className={inputCls} defaultValue="facility_billed">
          <option value="facility_billed">Facility billed</option>
          <option value="private_pay">Private pay / self-pay</option>
          <option value="medicaid">Medicaid</option>
          <option value="medicare">Medicare</option>
          <option value="mco">Managed Care Org (MCO)</option>
          <option value="waiver_program">Waiver program</option>
          <option value="va">VA</option>
        </select>
      </Field>

      <Field label="Special instructions">
        <textarea name="specialInstructions" rows={3} className={inputCls} placeholder="Use the east entrance, patient is non-verbal, etc." />
      </Field>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Booking…" : "Book trip"}
      </button>
    </form>
  );
}

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
